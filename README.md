# Quantumult X 个人脚本仓库

本仓库专用于存放 Quantumult X / Surge / Loon 的自动化签到、领币与重写脚本。

---

## 🪙 EZCompleteUI 3账号矩阵自动领币脚本 (`ezcomplete_daily.js`)

每 4 小时全自动并发为【主号 + 小号1 + 小号2】3 个账号矩阵向 Supabase 发起领币请求（每次 +10 币/号，每天全自动白嫖 180 币），合并为一条总结通知弹窗，自带 Token 过期检测、自动刷新与账号密码静默重登自愈机制。

### 📌 QX 配置方式

在 Quantumult X 配置文件中添加：

```ini
[task_local]
# 每 4 小时第 5 分钟自动执行一次
5 0,4,8,12,16,20 * * * https://raw.githubusercontent.com/YueBtt/QuantumultX-Scripts/main/ezcomplete_daily.js, tag=EZCompleteUI多账号领币, img-url=https://raw.githubusercontent.com/crossutility/Quantumult-X/master/quantumult-x.png, enabled=true

[mitm]
hostname = spuoimtqofhbdzosrbng.supabase.co
```

### 🔒 凭据配置说明（安全脱敏）

本脚本公网代码不包含任何明文账号密码，需在 QX 本地持久化存储中注入变量：
- `ez_acc1_email`、`ez_acc1_pwd`（主号）
- `ez_acc2_email`、`ez_acc2_pwd`（小号1，可选）
- `ez_acc3_email`、`ez_acc3_pwd`（小号2，可选）
未配置的账号槽位将自动静默跳过，绝不泄露个人隐私！
