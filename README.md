# Quantumult X 个人脚本仓库

本仓库专用于存放 Quantumult X / Surge / Loon 的自动化签到、领币与重写脚本。

---

## 🪙 EZCompleteUI 3账号矩阵自动领币脚本 (`ezcomplete_daily.js`)

每 4 小时全自动并发为【主号 + 小号1 + 小号2】3 个账号矩阵向 Supabase 发起领币请求（每次 +10 币/号，每天全自动白嫖 180 币），合并为一条总结通知弹窗，自带 Token 过期检测、自动刷新与账号密码静默重登自愈机制。

---

### 📌 第一步：QX 添加定时任务订阅

在 Quantumult X 配置文件（或 UI 界面的【Task 定时任务】）中添加：

```ini
[task_local]
# 每 4 小时第 10 分钟自动执行一次（避开整点/第5分钟可能残留的几秒或几十秒网络延迟抖动）
10 0,4,8,12,16,20 * * * https://raw.githubusercontent.com/YueBtt/QuantumultX-Scripts/main/ezcomplete_daily.js, tag=EZCompleteUI多账号领币, img-url=https://raw.githubusercontent.com/crossutility/Quantumult-X/master/quantumult-x.png, enabled=true

# （可选）重写远程订阅：打开 App 时无感自动捕获/更新最新 Token
[rewrite_remote]
https://raw.githubusercontent.com/YueBtt/QuantumultX-Scripts/main/ezcomplete.snippet, tag=EZCompleteUI, enabled=true

[mitm]
hostname = spuoimtqofhbdzosrbng.supabase.co
```

---

### 🔒 第二步：添加/配置自己的账号密码（安全脱敏）

本脚本公网代码不包含任何明文账号密码，绝不会泄露任何隐私！使用者通过以下 **任选一种方式** 配置自己的账号密码：

#### 💡 姿势 1：在 QX【持久化数据】界面直接可视化添加（最简单、小白推荐）
打开 Quantumult X ➔ 右下角小风车设置 ➔ 滑到最下方找到 **【持久化数据】**（构造请求下方）：
1. 点击右上角 **`+`**（添加新数据）；
2. 填写键值：
   * **Key (键名)**：`ezcomplete_email` ➔ **Value (内容)**：填你的邮箱（如 `your_email@qq.com`）
   * **Key (键名)**：`ezcomplete_password` ➔ **Value (内容)**：填你的密码
3. 如果有多账号（小号）：
   * 小号1：`ez_acc2_email` 与 `ez_acc2_pwd`
   * 小号2：`ez_acc3_email` 与 `ez_acc3_pwd`
4. 保存即可！脚本每次执行时会自动精准读取！

#### 💡 姿势 2：通过「BoxJS」或「快捷注入脚本」一键存入
在 QX 内运行一次单行 JS 写入（例如在 QX 脚本调试运行里执行）：
```javascript
$prefs.setValueForKey("你的邮箱", "ezcomplete_email");
$prefs.setValueForKey("你的密码", "ezcomplete_password");
// 小号（可选）
$prefs.setValueForKey("小号1邮箱", "ez_acc2_email");
$prefs.setValueForKey("小号1密码", "ez_acc2_pwd");
```

---

### ⚡ 特性说明
- **按需启用**：未配置的账号槽位会自动静默跳过；哪怕只配置一个主号，脚本也会完美单号运行！
- **步调对齐**：脚本自动计算账号冷却时间，智能避让并对齐主号，每 4 小时多账号同时起跑领币。
- **动态防封**：每次发包自动轮换随机伪装 IP 头（`X-Forwarded-For`），有效降低多账号同 IP 风控风险。
- **临界智能等待（防秒级抖动误判）**：当遇到网络延时导致各账号领币时间存在几秒或几十秒误差时，若检测到冷却剩余时间 <= 90 秒，脚本自动原地倒计时休眠等待，并自动发起精准二次补枪，彻底杜绝因为提前几秒而导致的领取扑空！

