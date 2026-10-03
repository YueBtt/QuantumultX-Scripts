/**
 * [task_local]
 * # 每 4 小时自动执行一次多账号领币（0点、4点、8点、12点、16点、20点第5分钟）
 * 5 0,4,8,12,16,20 * * * https://raw.githubusercontent.com/YueBtt/QuantumultX-Scripts/main/ezcomplete_daily.js, tag=EZCompleteUI多账号领币, img-url=https://raw.githubusercontent.com/crossutility/Quantumult-X/master/quantumult-x.png, enabled=true
 *
 * [mitm]
 * hostname = spuoimtqofhbdzosrbng.supabase.co
 */

const SUPABASE_URL = "https://spuoimtqofhbdzosrbng.supabase.co";
const ANON_KEY = "sb_publishable_AzEVhLuIj1nSMwZvIgKw7A__Y3Ghdtl";

// 3个账号矩阵池（生产级安全脱敏架构：优先从本地环境持久化变量读取，严禁公网硬编码泄露！）
const ACCOUNTS = [
    {
        name: "主号",
        email: $prefs.valueForKey("ez_acc1_email") || "",
        password: $prefs.valueForKey("ez_acc1_pwd") || "",
        key_token: "ezcomplete_token_main"
    },
    {
        name: "小号1",
        email: $prefs.valueForKey("ez_acc2_email") || "",
        password: $prefs.valueForKey("ez_acc2_pwd") || "",
        key_token: "ezcomplete_token_sub1"
    },
    {
        name: "小号2",
        email: $prefs.valueForKey("ez_acc3_email") || "",
        password: $prefs.valueForKey("ez_acc3_pwd") || "",
        key_token: "ezcomplete_token_sub2"
    }
].filter(a => a.email && a.password);

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
    const opts = {
        url: loginUrl,
        method: "POST",
        headers: {
            "apikey": ANON_KEY,
            "Content-Type": "application/json",
            "User-Agent": "EZCompleteUI/7.1.4 (iPhone; iOS 16.0; Scale/3.00)",
            "X-Forwarded-For": fakeIp,
            "X-Real-IP": fakeIp
        },
        body: JSON.stringify({ email: acc.email, password: acc.password })
    };
    $task.fetch(opts).then(
        resp => {
            try {
                const b = JSON.parse(resp.body);
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
            "User-Agent": "EZCompleteUI/7.1.4 (iPhone; iOS 16.0; Scale/3.00)",
            "X-Forwarded-For": fakeIp,
            "X-Real-IP": fakeIp,
            "Client-IP": fakeIp
        },
        body: "{}"
    };

    $task.fetch(options).then(
        resp => {
            try {
                const body = JSON.parse(resp.body);
                if (resp.statusCode === 200 || resp.statusCode === 201) {
                    const added = body.coins_added || body.coins || "10";
                    const balance = body.current_balance || body.balance || "未知";
                    console.log(`[EZCompleteUI] 账号【${acc.name}】领币成功！到账 +${added}，总余额: ${balance}`);
                    callback({ ok: true, name: acc.name, balance: balance, added: added, msg: `+${added}币 (总:${balance})` });
                    return;
                } else if (resp.statusCode === 401 && !isRetry) {
                    console.log(`[EZCompleteUI] 账号【${acc.name}】Token失效，重新登录换票中...`);
                    loginAccount(acc, (newTok) => {
                        if (newTok) {
                            claimForAccount(acc, newTok, callback, true);
                        } else {
                            callback({ ok: false, name: acc.name, msg: "Token已失效且登录失败" });
                        }
                    });
                    return;
                } else if (resp.statusCode === 400 || resp.statusCode === 429 || body.error || body.message) {
                    let tip = "冷却中";
                    if (body.next_claim_at) {
                        try {
                            const d = new Date(body.next_claim_at);
                            const beijingTime = d.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
                            tip = `冷却至 ${beijingTime}`;
                        } catch (te) {}
                    }
                    console.log(`[EZCompleteUI] 账号【${acc.name}】未到时间: ${tip}`);
                    callback({ ok: true, name: acc.name, msg: tip });
                    return;
                }
            } catch (e) {}
            callback({ ok: false, name: acc.name, msg: `HTTP ${resp.statusCode}` });
        },
        err => {
            callback({ ok: false, name: acc.name, msg: "网络错误" });
        }
    );
}

const isRequest = typeof $request !== "undefined";
const isResponse = typeof $response !== "undefined";

if (isRequest || isResponse) {
    $done({});
} else {
    if (ACCOUNTS.length === 0) {
        console.log("[EZCompleteUI] 未在 QX 本地配置账号密码，跳过执行。");
        $done();
    } else {
        console.log(`[EZCompleteUI 矩阵调度器] 开始并发调度 ${ACCOUNTS.length} 个账号...`);
        const results = [];
        let pending = ACCOUNTS.length;

        const nowBeijing = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
        const currentHour = nowBeijing.getHours();

        ACCOUNTS.forEach((acc) => {
            if (acc.name !== "主号" && currentHour >= 6 && currentHour < 8) {
                console.log(`[EZCompleteUI] 账号【${acc.name}】主动跳过 6 点轮次，等待 08:05 与大号同时起跑对齐！`);
                results.push(`【${acc.name}】主动待命中 (对齐至 08:05 与大号同时领)`);
                checkFinish();
                return;
            }

            getValidToken(acc, (token) => {
                if (!token) {
                    results.push(`【${acc.name}】无法获取有效Token`);
                    checkFinish();
                } else {
                    claimForAccount(acc, token, (res) => {
                        results.push(`【${res.name}】${res.msg}`);
                        checkFinish();
                    });
                }
            });
        });

        function checkFinish() {
            pending--;
            if (pending <= 0) {
                const summary = results.join("\n");
                console.log("[EZCompleteUI 多账号领币汇报]\n" + summary);
                const hasSuccess = results.some(r => r.includes("+") && r.includes("币"));
                const hasRealError = results.some(r => r.includes("失败") || r.includes("HTTP"));
                if (hasSuccess || hasRealError) {
                    $notify("EZCompleteUI 账号矩阵领币", hasSuccess ? "💰 领币到账汇报" : "⚠️ 领币异常提示", summary);
                }
                $done();
            }
        }
    }
}
