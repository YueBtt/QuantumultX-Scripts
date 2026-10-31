/**
 * APInex 每日配额与自动签到保活 (Quantumult X 脚本)
 * 支持自动签到打卡，若已就绪则输出剩余额度
 */

const API_KEY = $prefs.valueForKey("APINEX_API_KEY") || "sk-apxe8aea632e560bb42dcda8c241fda7eec936db1f92a1d1bf";
const USER_SESSION = $prefs.valueForKey("APINEX_SESSION") || "93f1b0973d585e45df03226e2bdbfe10a0694b314436e16d4d3171d21331c071";

function notify(title, subtitle, message) {
    if (typeof $notify !== "undefined") {
        $notify(title, subtitle, message);
    } else {
        console.log(`[${title}] ${subtitle} - ${message}`);
    }
}

// 自动签到尝试
function tryAutoCheckin(onSuccess, onFail) {
    const checkinReq = {
        url: "https://api.apinex.bond/api/user/checkin",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": `apinex_user_session=${USER_SESSION}; session=${USER_SESSION}`,
            "X-Apinex-Session": USER_SESSION,
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)"
        },
        body: JSON.stringify({ turnstileToken: "" })
    };

    $task.fetch(checkinReq).then(resp => {
        try {
            const data = JSON.parse(resp.body);
            if (resp.statusCode === 200) {
                onSuccess(data);
            } else {
                onFail(data.error || resp.body);
            }
        } catch (e) {
            onFail(e.message);
        }
    }, err => {
        onFail(String(err));
    });
}

// 探测 API Key 可用性
function checkApinexStatus() {
    const testReq = {
        url: "https://api.apinex.bond/v1/chat/completions",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`,
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)"
        },
        body: JSON.stringify({
            model: "free/gemini-3.8-flash",
            messages: [{ role: "user", content: "1+1=? reply 1 number only" }],
            stream: false
        })
    };

    $task.fetch(testReq).then(response => {
        try {
            const data = JSON.parse(response.body);
            if (response.statusCode === 200 && data.choices && data.choices.length > 0) {
                notify(
                    "APInex 每日配额",
                    "🟢 2000万额度已就绪",
                    `模型正常响应: ${data.choices[0].message.content.trim()}`
                );
                $done();
            } else if (response.statusCode === 402 || (data.error && data.error.message && data.error.message.includes("Daily check-in"))) {
                // 尝试执行自动签到
                tryAutoCheckin(
                    (succ) => {
                        notify("APInex 每日配额", "🎉 自动签到成功！", "已解锁今日 20,000,000 Tokens 免费额度。");
                        $done();
                    },
                    (failMsg) => {
                        notify(
                            "APInex 每日配额",
                            "🟡 待手动点击打卡",
                            "自动跳盾受阻，请在浏览器中打开 apinex.bond 完成一次人机验证。"
                        );
                        $done();
                    }
                );
            } else {
                const errMsg = data.error ? data.error.message : response.body;
                notify("APInex 每日体检", "⚠️ 状态异常", `HTTP ${response.statusCode}: ${errMsg}`);
                $done();
            }
        } catch (e) {
            notify("APInex 每日体检", "❌ 解析异常", `错误: ${e.message}`);
            $done();
        }
    }, reason => {
        notify("APInex 每日体检", "❌ 网络连接失败", reason.error || String(reason));
        $done();
    });
}

checkApinexStatus();
