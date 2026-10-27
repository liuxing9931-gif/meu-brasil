# Fala · 巴葡情景学习

面向中文学习者的巴西葡语学习 PWA，支持情景课堂、间隔复习、学习足迹和 AI 口语搭子 Lucas。

## 这次增加了什么

- 收藏复习：点击“显示葡语答案”后立即自动朗读，仍需设备安装 pt-BR 语音。
- 趣味打卡：每日首次打开自动打卡，展示近七天印章、连续天数、萌芽/成长状态、三日和一周徽章；中断后再次打开会温和提醒重新开始。以设备当地日期为准，切换时区会影响日期。
- 学习足迹：移除每日学习时段列表，保留学习日历和最近七天每天的学习分钟数。不再产生新的时段记录，已有记录和旧备份仍兼容。
- 新增“餐厅点餐”“工作协作”：每个场景 20 句三语对照对话、5 组短语和 10 轮互动练习。
- 首页进入 AI 口语搭子 Lucas：默认男性，支持中、英、巴葡文字对话、表达建议、主动话题、语音转文字、回复朗读、单词释义与收藏。

## 免费能做到哪些

| 能力 | 实现和限制 |
| --- | --- |
| 课程、打卡、复习、统计、离线 | 本地运行，无 AI 费用。 |
| 语音输入 | 浏览器 SpeechRecognition，不收取本项目 API 费；兼容性、识别服务联网和可用地区取决于浏览器。识别内容先转成可编辑文字，点击发送才交给本项目 AI 后端。浏览器自身的语音服务可能会处理录音。 |
| 朗读和男女声 | 浏览器 speechSynthesis，无本项目 AI 语音费用；需要对应语言语音包。没有标准的性别字段，只能按语音名称尽力匹配，最终可手动选实际声音。默认优先男声，缺少时明确提示。 |
| 智能纠错、自由对话、扩展话题 | 需要真正的语言模型。可自行在本机运行 Ollama，或申请服务商 API。Gemini API 在符合条件的账户/地区/模型可能有免费层，不能保证额度、长期免费或每个地区可用。免费层的数据使用政策也需阅读。 |
| 关闭网页后的提醒 | 本版不做后台定时推送；提供网页内提醒和回来时的鼓励。即使安装 PWA，也不保证关闭应用后有通知。如需要定时推送，需要另接服务端任务、Web Push 和用户通知授权。 |

模型服务说明：[Gemini 价格及免费层](https://ai.google.dev/gemini-api/docs/pricing)、[OpenAI 兼容接口](https://ai.google.dev/gemini-api/docs/openai)。示例模型名称和可用额度以你的控制台为准。本次开发环境无法访问这些文档，未核实当前免费额度，也未用真实密钥调用模型。自动化测试使用模拟模型，不能替代你的账户联调。

## 本地打开

静态功能无需 npm、构建或依赖安装：

```bash
cd /path/to/meu-brasil
python3 -m http.server 8000 --bind 127.0.0.1
```

要运行 AI 后端（Python 3.10+，仅标准库），先复制配置：

```bash
cp .env.example .env
```

在本机编辑 `.env`，填写服务商密钥；不要把密钥提交到 GitHub，不要在网页、聊天或截图中分享。加载配置并启动：

```bash
set -a
. ./.env
set +a
python3 server.py --port 8001
```

`server.py` 同时提供网页和 `/api/status`、`/api/chat`。本地检查可用 `curl -f http://127.0.0.1:8001/api/status`；`configured: true` 仅表示必要配置存在，真实可用性需发送一次对话验证。

通过这个服务器打开网页时，搭子“后端网址”留空。若从另一个端口或 GitHub Pages 打开，请填写后端完整地址，并把该网页的 origin 加入 `FALA_ALLOWED_ORIGINS`。Origin 只包含协议、主机和端口，不包含项目路径。

### 方案 A：尝试 Gemini API 免费层

在 [Google AI Studio](https://aistudio.google.com/) 申请 API Key，并确认你的地区、模型和账户支持免费层。示例环境变量：

```dotenv
FALA_AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
FALA_AI_MODEL=gemini-2.5-flash
FALA_AI_API_KEY=在服务器私密环境变量中填写
```

示例模型若不可用，用控制台中支持 OpenAI 兼容聊天接口的模型替换。出现 429 时检查限额，不要反复重试；不要为了试用随意打开自动付费。

### 方案 B：付费兼容接口

可以换成支持 `/chat/completions` 的服务商，例如：

```dotenv
FALA_AI_BASE_URL=https://api.openai.com/v1
FALA_AI_MODEL=gpt-4o-mini
FALA_AI_API_KEY=在服务器私密环境变量中填写
```

模型必须支持聊天消息、system 指令和 `max_tokens` 参数，并能按提示返回 JSON。不同服务商和模型参数并不完全相同，遇到不兼容需调整适配器。API Base URL 不包含 `/chat/completions`。请在服务商控制台设置额度/预算。本项目单个进程默认最多 100 次尝试、全局每分钟 10 次、同时最多 2 次；重启会重置，**这些限制不等同于持久化账单上限**。`FALA_MAX_REQUESTS` 可调。

### 方案 C：本地模型，不购买 API

如果你的电脑已安装 Ollama 且资源足够，先拉取一个适合的多语言模型，再设置：

```dotenv
FALA_AI_BASE_URL=http://127.0.0.1:11434/v1
FALA_AI_MODEL=qwen2.5:7b
FALA_AI_API_KEY=
```

这不需要购买 API，但模型下载、硬件和电力有成本，中文/葡语及 JSON 输出质量取决于模型。本项目没有下载或验证这个模型。GitHub Pages 是 HTTPS，不能直接请求普通公网 HTTP；网页配合本地模型建议从本机 `server.py` 打开，或自行配置安全的 HTTPS 后端。

## 你正在用 GitHub Pages：如何上线

GitHub Pages 只能托管静态文件，无法运行 Python 或保管服务端密钥。上传本次代码后，课程、打卡、复习仍可直接用；真实 AI 必须再部署一个后端。

1. 把此仓库部署到支持 Python 进程与 HTTPS 的平台，例如你已有的 VPS 或容器平台。也可以用附带的 `Dockerfile` 部署，容器监听端口由 `PORT` 决定。免费托管政策可能变化，不在此保证免费。
2. 在平台的私密环境变量设置中填入 `FALA_AI_BASE_URL`、`FALA_AI_MODEL`、`FALA_AI_API_KEY`，并设置自己生成的强密码 `FALA_ACCESS_PASSWORD`。
3. 设置 `FALA_ALLOWED_ORIGINS=https://liuxing9931-gif.github.io`。若使用自定义域名，应改成实际的网页 origin；多个来源用英文逗号分隔，不能用 `*`。
4. 启动命令：`python3 server.py --host 0.0.0.0 --port 8001`。若平台提供 `PORT`，使用 `python3 server.py --host 0.0.0.0` 自动读取。公网监听没有访问密码时会拒绝启动。务必通过平台 HTTPS 访问，不能把 API Key 填入网页。
5. 在 GitHub Pages 的“AI 口语搭子”中填入后端 HTTPS 网址及你设置的**后端访问密码**，点击检查连接，然后发送一条消息完成联调。

浏览器只记住后端地址；访问密码仅保留在当前页面内，刷新后需重填。此轻量密码适合本人或小范围使用。公网多人产品还需要账户隔离、持久配额、监控等。不要把访问密码当成服务商 API Key，也不要把服务商 API Key 当成访问密码。

后端只允许列出的静态资源，`.env`、Python 源文件和 Git 元数据不会被它提供；API 响应不被 Service Worker 缓存。后端不持久化对话，向模型发送最近 20 条消息；前端页面刷新会清除对话，生词收藏仍保留。后端禁用请求日志，但部署平台及模型提供商可能有自己的日志策略。

## 将代码更新到 GitHub

本次代码修改不会自动推送或部署。

如果不熟悉 Git：下载本次提供的代码包并解压，在 GitHub 仓库打开 **Add file → Upload files**，上传解压后的文件和 `tests` 文件夹，确认覆盖同名文件后选择 **Commit changes**。不要只上传 ZIP 压缩包本身。后端部署和 API 配置仍需按上一节完成。

若在自己的电脑使用 Git 操作：

```bash
git clone https://github.com/liuxing9931-gif/meu-brasil.git
cd meu-brasil
git switch -c feature/lucas-and-checkin
# 将本次修改文件放入该目录，然后检查变更：
git diff
# 先按下一节完成验证，再提交；确认 .env 没有被加入。
git add app.js buddy.js core.js data.js index.html style.css sw.js server.py README.md .gitignore .env.example Dockerfile .dockerignore tests
git commit -m "Add daily check-ins, new lessons and Lucas AI partner"
git push -u origin feature/lucas-and-checkin
```

在 GitHub 打开该分支的 Pull Request，核对改动后合并到 `main`。若 Pages 已配置从 `main` 根目录部署，合并后等待部署完成。已有离线缓存会在更新联网加载并激活后刷新；若仍是旧版，关闭此站点所有标签页再重新打开。先导出学习备份，避免清理站点数据时丢失收藏。

## 验证

后端测试无需真实密钥，也不调用外部服务：

```bash
python3 -m unittest discover -s tests -p test_server.py -v
```

浏览器集成测试需测试机器安装 Python Playwright 和 Chromium；运行时使用假语音与模拟 AI，验证界面及接口连接，不验证真实声音或真实模型质量：

```bash
python3 -m pip install playwright
# 若未安装 Chromium，可安装系统 Chromium 或 playwright install chromium 并调整 CHROMIUM_PATH。
CHROMIUM_PATH=/usr/bin/chromium python3 -m unittest discover -s tests -p test_ui.py -v
```

上线后还需在你的手机/电脑手动验证：男声包、三语语音识别权限、真实 API 对话及额度、自定义域名 CORS。收藏/学习记录仅在当前浏览器，建议定期在学习设置导出备份。
