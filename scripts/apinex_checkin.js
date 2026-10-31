/**
 * APInex 每日配额体检与状态探针 (Quantumult X 脚本)
 * 兼容 QX v1.7.0 构建规范，带控制台详细调试日志与系统级通知
 */

console.log("[APInex] 开始执行每日配额检查...");

const API_KEY = $prefs.valueForKey("APINEX_API_KEY") || "sk-apxe8aea632e560bb42dcda8c241fda7eec936db1f92a1d1bf";

function notify(title, subtitle, message) {
    console.log(`[APInex] 通知下发: ${title} | ${subtitle} | ${message}`);
    if (typeof $notify !== "undefined") {
        $notify(title, subtitle, message);
    }
}

function checkApinexStatus() {
    console.log("[APInex] 准备发起官方接口测试请求...");
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
        console.log(`[APInex] 收到响应 HTTP 状态码: ${response.statusCode}`);
        console.log(`[APInex] 原始响应 Body: ${response.body}`);
        try {
            const data = JSON.parse(response.body);
            if (response.statusCode === 200 && data.choices && data.choices.length > 0) {
                const reply = data.choices[0].message.content.trim();
                console.log(`[APInex] 模型测试正常，回复内容: ${reply}`);
                notify(
                    "APInex 每日配额",
                    "🟢 2000万额度已就绪",
                    `免费模型通道正常运转 (响应: ${reply})`
                );
            } else if (response.statusCode === 402 || (data.error && data.error.message && data.error.message.includes("Daily check-in"))) {
                console.log("[APInex] 今日免费额度待打卡激活");
                notify(
                    "APInex 每日配额",
                    "🟡 今日免费额度待激活",
                    "请点开官网完成今日签到打卡，即可解锁 20,000,000 Tokens 免费额度。"
                );
            } else {
                const errMsg = data.error ? data.error.message : response.body;
                console.log(`[APInex] 异常状态: ${errMsg}`);
                notify("APInex 每日体检", "⚠️ 状态异常", `HTTP ${response.statusCode}: ${errMsg}`);
            }
        } catch (e) {
            console.log(`[APInex] 数据解析异常: ${e.message}`);
            notify("APInex 每日体检", "❌ 解析异常", `错误: ${e.message}`);
        }
        $done();
    }, reason => {
        const errStr = reason.error || String(reason);
        console.log(`[APInex] 网络请求失败: ${errStr}`);
        notify("APInex 每日体检", "❌ 网络连接失败", errStr);
        $done();
    });
}

checkApinexStatus();
