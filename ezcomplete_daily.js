/**
 * [task_local]
 * # 每 4 小时自动执行一次多账号领币（建议第 10 分钟触发，避让领取时产生的秒级/分钟级网络延时）
 * 10 0,4,8,12,16,20 * * * https://raw.githubusercontent.com/YueBtt/QuantumultX-Scripts/main/ezcomplete_daily.js, tag=EZCompleteUI多账号领币, img-url=https://raw.githubusercontent.com/crossutility/Quantumult-X/master/quantumult-x.png, enabled=true
 */

const SUPABASE_URL = "https://spuoimtqofhbdzosrbng.supabase.co";
const ANON_KEY = "sb_publishable_AzEVhLuIj1nSMwZvIgKw7A__Y3Ghdtl";

function getPref(key) {
    let val = $prefs.valueForKey(key);
    if (val === null || val === undefined) return "";
    return String(val).trim();
}

function loadAccountsFromStorage() {
    const list = [];
    const read_debug = [];

    for (let i = 1; i <= 10; i++) {
        let name = i === 1 ? "主号" : `小号${i-1}`;
        let em = i === 1 ? (getPref("ezcomplete_email") || getPref("ez_acc1_email")) : getPref(`ez_acc${i}_email`);
        let pwd = i === 1 ? (getPref("ezcomplete_password") || getPref("ez_acc1_pwd")) : getPref(`ez_acc${i}_pwd`);
        let key_tok = i === 1 ? "ezcomplete_token_main" : `ezcomplete_token_acc${i}`;

        if (em && pwd) {
            read_debug.push(`${name}: OK|OK`);
            list.push({
                name: name,
                email: em,
                password: pwd,
                key_token: key_tok
            });
        }
    }

    console.log(`[EZCompleteUI 原始读取] ` + read_debug.join(", "));
    return list;
}

function getRandomIP() {
    const prefixes = [104, 172, 198, 23, 45, 66, 114, 223];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    return `${p}.${Math.floor(Math.random() * 240 + 10)}.${Math.floor(Math.random() * 240 + 10)}.${Math.floor(Math.random() * 240 + 10)}`;
}

function isTokenExpired(token) {
    if (!token) return true;
    try {
        const parts = token.split(".");
        if (parts.length < 2) return true;
        let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) {
            base64 += "=";
        }
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        let output = "";
        for (let bc = 0, bs = 0, buffer, idx = 0; buffer = base64.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
            buffer = chars.indexOf(buffer);
        }
        const json = JSON.parse(output);
        const exp = json.exp;
        const now = Math.floor(Date.now() / 1000);
        return exp - now < 120;
    } catch (e) {
        return false;
    }
}

function loginAccount(acc, callback) {
    const loginUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
    const fakeIp = getRandomIP();
    const options = {
        url: loginUrl,
        method: "POST",
        headers: {
            "apikey": ANON_KEY,
            "Content-Type": "application/json",
            "X-Forwarded-For": fakeIp,
            "Client-IP": fakeIp,
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
        },
        body: JSON.stringify({
            email: acc.email,
            password: acc.password
        })
    };

    $task.fetch(options).then(
        response => {
            try {
                const b = JSON.parse(response.body);
                if (b.access_token) {
                    $prefs.setValueForKey(b.access_token, acc.key_token);
                    if (acc.name === "主号") {
                        $prefs.setValueForKey(b.access_token, "ezcomplete_token");
                    }
                    callback(b.access_token);
                    return;
                }
            } catch (e) {}
            callback(null);
        },
        err => {
            console.log(`[EZCompleteUI] 账号【${acc.name}】登录失败: ${err}`);
            callback(null);
        }
    );
}

function getValidToken(acc, callback) {
    let tok = $prefs.valueForKey(acc.key_token);
    if (!tok && acc.name === "主号") {
        tok = $prefs.valueForKey("ezcomplete_token");
    }
    if (!tok || isTokenExpired(tok)) {
        loginAccount(acc, callback);
    } else {
        callback(tok);
    }
}

function claimForAccount(acc, token, callback, isRetry) {
    const claimUrl = `${SUPABASE_URL}/functions/v1/claim-daily-coins`;
    const fakeIp = getRandomIP();
    const options = {
        url: claimUrl,
        method: "POST",
        headers: {
            "apikey": ANON_KEY,
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Forwarded-For": fakeIp,
            "Client-IP": fakeIp,
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
        },
        body: "{}"
    };

    $task.fetch(options).then(
        response => {
            try {
                const res = JSON.parse(response.body);
                if (res.success) {
                    const msg = `🎉 领币成功！+${res.coins_added} 币 (余额: ${res.balance})`;
                    console.log(`[EZCompleteUI] 账号【${acc.name}】${msg}`);
                    callback({ name: acc.name, success: true, text: msg });
                } else if (res.next_claim_at) {
                    const nextTime = new Date(res.next_claim_at);
                    const now = new Date();
                    const diffSec = Math.floor((nextTime.getTime() - now.getTime()) / 1000);

                    if (!isRetry && diffSec > 0 && diffSec <= 90) {
                        const waitMs = (diffSec + 3) * 1000;
                        console.log(`[EZCompleteUI] 账号【${acc.name}】处于秒级临界点 (剩余 ${diffSec}s)，进入原地休眠自愈补枪 (${waitMs/1000}s)...`);
                        setTimeout(() => {
                            claimForAccount(acc, token, callback, true);
                        }, waitMs);
                        return;
                    }

                    const timeStr = nextTime.toTimeString().split(" ")[0];
                    const msg = `未到时间: 冷却至 ${timeStr}`;
                    console.log(`[EZCompleteUI] 账号【${acc.name}】${msg}`);
                    callback({ name: acc.name, success: false, text: msg });
                } else {
                    const msg = `响应异常: ${response.body}`;
                    console.log(`[EZCompleteUI] 账号【${acc.name}】${msg}`);
                    callback({ name: acc.name, success: false, text: msg });
                }
            } catch (e) {
                callback({ name: acc.name, success: false, text: `解析失败: ${e.message}` });
            }
        },
        err => {
            callback({ name: acc.name, success: false, text: `网络错误: ${err}` });
        }
    );
}

// 调度主逻辑
const ACCOUNTS = loadAccountsFromStorage();
console.log(`[EZCompleteUI 诊断] 成功加载有效账号数: ${ACCOUNTS.length}`);

if (ACCOUNTS.length === 0) {
    console.log("[EZCompleteUI] 未在 QX 本地配置任何有效账号密码，跳过执行。");
    $done();
} else {
    console.log(`[EZCompleteUI 矩阵调度器] 开始并发调度 ${ACCOUNTS.length} 个账号...`);
    let completed = 0;
    const results = [];

    ACCOUNTS.forEach(acc => {
        getValidToken(acc, token => {
            if (!token) {
                results.push({ name: acc.name, success: false, text: "获取/刷新 Token 失败" });
                completed++;
                if (completed === ACCOUNTS.length) finishAll(results);
                return;
            }

            claimForAccount(acc, token, res => {
                results.push(res);
                completed++;
                if (completed === ACCOUNTS.length) finishAll(results);
            });
        });
    });
}

function finishAll(results) {
    results.sort((a, b) => a.name.localeCompare(b.name));
    const lines = results.map(r => `【${r.name}】${r.text}`);
    const summary = lines.join("\n");
    console.log(`[EZCompleteUI 多账号领币汇报]\n${summary}`);
    $notify("EZCompleteUI 10账号矩阵领币", `已完成 ${results.length} 个账号全量轮询`, summary);
    $done();
}
