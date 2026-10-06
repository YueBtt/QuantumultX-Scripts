/**
 * [task_local]
 * # 每 4 小时自动执行一次多账号领币（完美对齐 12:20 冷却结束，22分精准收割）
 * 22 0,4,8,12,16,20 * * * https://raw.githubusercontent.com/YueBtt/QuantumultX-Scripts/main/ezcomplete_daily.js, tag=EZCompleteUI多账号领币, img-url=https://raw.githubusercontent.com/crossutility/Quantumult-X/master/quantumult-x.png, enabled=true
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
        let name = i === 1 ? "主号" : ("小号" + (i - 1));
        let em = i === 1 ? (getPref("ezcomplete_email") || getPref("ez_acc1_email")) : getPref("ez_acc" + i + "_email");
        let pwd = i === 1 ? (getPref("ezcomplete_password") || getPref("ez_acc1_pwd")) : getPref("ez_acc" + i + "_pwd");
        let key_tok = i === 1 ? "ezcomplete_token_main" : ("ezcomplete_token_acc" + i);

        if (em && pwd) {
            read_debug.push(name + ": OK|OK");
            list.push({
                name: name,
                email: em,
                password: pwd,
                key_token: key_tok
            });
        }
    }

    console.log("[EZCompleteUI 原始读取] " + read_debug.join(", "));
    return list;
}

function getRandomIP() {
    const prefixes = [104, 172, 198, 23, 45, 66, 114, 223];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    return `${p}.${Math.floor(Math.random() * 240 + 10)}.${Math.floor(Math.random() * 240 + 10)}.${Math.floor(Math.random() * 240 + 10)}`;
}

function isTokenValid(token) {
    if (!token || typeof token !== "string" || token.length < 50) return false;
    try {
        const parts = token.split(".");
        if (parts.length < 2) return false;
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
        return (exp - now) > 300;
    } catch (e) {
        return false;
    }
}

// 登录换票（带重试机制，带错误详情提取）
function loginAccountWithRetry(acc, callback, retryCount = 0) {
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
                    console.log(`[EZCompleteUI] 账号【${acc.name}】登录换票成功！`);
                    callback(b.access_token);
                    return;
                }
            } catch (e) {}

            if (retryCount < 2) {
                const delayMs = (retryCount + 1) * 2000;
                console.log(`[EZCompleteUI] 账号【${acc.name}】登录响应解析异常 (${response.body})，${delayMs/1000}s 后重试...`);
                setTimeout(() => loginAccountWithRetry(acc, callback, retryCount + 1), delayMs);
            } else {
                console.log(`[EZCompleteUI] 账号【${acc.name}】连续 3 次登录失败: ${response.body}`);
                callback(null);
            }
        },
        err => {
            const errStr = typeof err === "object" ? JSON.stringify(err) : String(err);
            if (retryCount < 2) {
                const delayMs = (retryCount + 1) * 2000;
                console.log(`[EZCompleteUI] 账号【${acc.name}】登录网络抖动 (${errStr})，${delayMs/1000}s 后重试...`);
                setTimeout(() => loginAccountWithRetry(acc, callback, retryCount + 1), delayMs);
            } else {
                console.log(`[EZCompleteUI] 账号【${acc.name}】连续 3 次登录网络错误: ${errStr}`);
                callback(null);
            }
        }
    );
}

// 获取有效 Token：优先读本地缓存，有效直接用；失效才走登录
function getValidToken(acc, callback) {
    let tok = $prefs.valueForKey(acc.key_token);
    if (!tok && acc.name === "主号") {
        tok = $prefs.valueForKey("ezcomplete_token");
    }

    if (isTokenValid(tok)) {
        console.log(`[EZCompleteUI] 账号【${acc.name}】命中本地有效Token，跳过登录直接领币！`);
        callback(tok);
    } else {
        console.log(`[EZCompleteUI] 账号【${acc.name}】Token缺失或已过期，发起实时登录换票...`);
        loginAccountWithRetry(acc, callback);
    }
}

// 领币核心逻辑（遇 401 自动重新换票，遇网络抖动重试 3 次，遇临界抖动秒级休眠补枪）
function claimForAccountWithRetry(acc, token, callback, retryCount = 0, isJitterSelfHeal = false) {
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
                
                // 1. 成功到账
                if (res.success) {
                    const msg = `🎉 领币成功！+${res.coins_added} 币 (余额: ${res.balance})`;
                    console.log(`[EZCompleteUI] 账号【${acc.name}】${msg}`);
                    callback({ name: acc.name, success: true, text: msg });
                    return;
                }
                
                // 2. 冷却中
                if (res.next_claim_at) {
                    const nextTime = new Date(res.next_claim_at);
                    const now = new Date();
                    const diffSec = Math.floor((nextTime.getTime() - now.getTime()) / 1000);

                    // 秒级临界抖动自愈：若相差 <= 90秒，原地休眠后补枪
                    if (!isJitterSelfHeal && diffSec > 0 && diffSec <= 90) {
                        const waitMs = (diffSec + 3) * 1000;
                        console.log(`[EZCompleteUI] 账号【${acc.name}】临界抖动 (差 ${diffSec}s)，自动原地休眠 ${waitMs/1000}s 精准补枪！`);
                        setTimeout(() => {
                            claimForAccountWithRetry(acc, token, callback, 0, true);
                        }, waitMs);
                        return;
                    }

                    const timeStr = nextTime.toTimeString().split(" ")[0];
                    const msg = `未到时间: 冷却至 ${timeStr}`;
                    console.log(`[EZCompleteUI] 账号【${acc.name}】${msg}`);
                    callback({ name: acc.name, success: false, text: msg });
                    return;
                }

                // 3. Unauthorized 彻底自愈：Token 过期或失效，清除缓存并重新登录换票
                if (res.error === "Unauthorized" || String(response.body).includes("Unauthorized")) {
                    if (retryCount < 2) {
                        console.log(`[EZCompleteUI 🔑Token自愈] 账号【${acc.name}】Token过期(Unauthorized)，重新登录换票并补发...`);
                        $prefs.setValueForKey("", acc.key_token);
                        loginAccountWithRetry(acc, newToken => {
                            if (newToken) {
                                claimForAccountWithRetry(acc, newToken, callback, retryCount + 1, isJitterSelfHeal);
                            } else {
                                callback({ name: acc.name, success: false, text: "重新换票失败" });
                            }
                        });
                        return;
                    }
                }

                // 4. 其他异常返回
                if (retryCount < 2) {
                    const delayMs = (retryCount + 1) * 2000;
                    console.log(`[EZCompleteUI] 账号【${acc.name}】返回异常 (${response.body})，${delayMs/1000}s 后重试...`);
                    setTimeout(() => claimForAccountWithRetry(acc, token, callback, retryCount + 1, isJitterSelfHeal), delayMs);
                } else {
                    const msg = `响应异常: ${response.body}`;
                    console.log(`[EZCompleteUI] 账号【${acc.name}】${msg}`);
                    callback({ name: acc.name, success: false, text: msg });
                }
            } catch (e) {
                if (retryCount < 2) {
                    const delayMs = (retryCount + 1) * 2000;
                    console.log(`[EZCompleteUI] 账号【${acc.name}】解析失败 (${e.message})，${delayMs/1000}s 后重试...`);
                    setTimeout(() => claimForAccountWithRetry(acc, token, callback, retryCount + 1, isJitterSelfHeal), delayMs);
                } else {
                    callback({ name: acc.name, success: false, text: `解析失败: ${e.message}` });
                }
            }
        },
        err => {
            const errStr = typeof err === "object" ? JSON.stringify(err) : String(err);
            if (retryCount < 2) {
                const delayMs = (retryCount + 1) * 2500;
                console.log(`[EZCompleteUI 🛡️自愈防御] 账号【${acc.name}】领币网络错误 (${errStr})，${delayMs/1000}s 后重发...`);
                setTimeout(() => claimForAccountWithRetry(acc, token, callback, retryCount + 1, isJitterSelfHeal), delayMs);
            } else {
                callback({ name: acc.name, success: false, text: `网络错误 (已重试3次): ${errStr}` });
            }
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
    console.log(`[EZCompleteUI 矩阵调度器] 开始错峰并发调度 ${ACCOUNTS.length} 个账号...`);
    let completed = 0;
    const results = [];

    ACCOUNTS.forEach((acc, idx) => {
        const staggerDelay = idx * 450;

        setTimeout(() => {
            getValidToken(acc, token => {
                if (!token) {
                    results.push({ name: acc.name, success: false, text: "登录换票失败" });
                    completed++;
                    if (completed === ACCOUNTS.length) finishAll(results);
                    return;
                }

                claimForAccountWithRetry(acc, token, res => {
                    results.push(res);
                    completed++;
                    if (completed === ACCOUNTS.length) finishAll(results);
                });
            });
        }, staggerDelay);
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
