/**
 * APInex 每日配额体检与状态探针 (Quantumult X 脚本)
 * 
 * 作用：每日定时通过 QX 后台检查 APInex 官方 Key 与免费模型额度健康度，
 *       推送通知提醒额度状态与剩余 Tokens。
 * 
 * 配置范例 (可直接使用 $prefs 持久化或在脚本内配置 Key):
 * [task_local]
 * 5 8 * * * https://raw.githubusercontent.com/YueBtt/quantumult-x-rules/main/scripts/apinex_checkin.js, tag=APInex每日配额, img-url=https://raw.githubusercontent.com/YueBtt/quantumult-x-rules/main/icons/apinex.png, enabled=true
 */

const API_KEY = $prefs.valueForKey("APINEX_API_KEY") || "sk-apxe8aea632e560bb42dcda8c241fda7eec936db1f92a1d1bf";

function notify(title, subtitle, message) {
    if (typeof $notify !== "undefined") {
        $notify(title, subtitle, message);
    } else {
        console.log(`[${title}] ${subtitle} - ${message}`);
    }
}

function checkApinexStatus() {
    if (!API_KEY) {
        notify("APInex 每日体检", "❌ 缺少凭据", "请在 QX $prefs 中配置 APINEX_API_KEY");
        $done();
        return;
    }

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
                    `免费模型通道正常运转 (响应: ${data.choices[0].message.content.trim()})`
                );
            } else if (response.statusCode === 402 || (data.error && data.error.message && data.error.message.includes("Daily check-in"))) {
                notify(
                    "APInex 每日配额",
                    "🟡 今日免费额度待激活",
                    "请点开官网完成今日签到打卡，即可解锁 20,000,000 Tokens 免费额度。"
                );
            } else {
                const errMsg = data.error ? data.error.message : response.body;
                notify("APInex 每日体检", "⚠️ 状态异常", `HTTP ${response.statusCode}: ${errMsg}`);
            }
        } catch (e) {
            notify("APInex 每日体检", "❌ 解析异常", `错误: ${e.message}`);
        }
        $done();
    }, reason => {
        notify("APInex 每日体检", "❌ 网络连接失败", reason.error || String(reason));
        $done();
    });
}

checkApinexStatus();
