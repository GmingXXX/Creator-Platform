# 本地真实模型服务

启动：`node server/index.mjs`。默认仅监听 `127.0.0.1:8787`；同一地址提供 `dist/` 正式构建与 `/api/ai/*`。开发服务可将 `/api` 代理至此端口。

这是单用户本机演示服务，不是多人权限后端。仅接受本机 Host、指定本机 Origin；POST 要求 JSON 与 `X-ZC-Client: studio`。上线多人服务前必须添加真实身份认证、成员权限、租户数据分区、审计与配额。

配置只在服务端读取：

- `DEEPSEEK_API_KEY`，未设置时读取项目根目录指定的本地 DeepSeek 凭据文件。
- `DASHSCOPE_API_KEY`，未设置时完整读取项目根目录百炼 CSV 的 `apiKey` 字段（支持新版含点格式）。CSV 的 `dashScope` / `apiHost` 作为已验证的北京业务空间域名；剥离末尾 `/api/v1` 后再拼接接口路径。
- `DASHSCOPE_BASE_URL` 可覆盖服务域名，只接受受支持的百炼 HTTPS 域名。设置环境变量密钥时，不再读取 CSV。
- `DASHSCOPE_REGION=beijing|singapore|virginia`。本地 CSV 明确地域时可识别；否则默认北京，实际账户仍需验证。
- `WAN_IMAGE_MODEL` 默认 `wan2.6-t2i`。支持明确配置的万相 2.2 / 2.1 / 2.5 文生图型号，不自动跨模型降级。
- `AI_PORT` 默认 8787。

不得将密钥放到 `VITE_` 环境变量、前端持久化状态或交付 ZIP。`.local/ai/` 是任务、提示词和生成媒体的私有本地目录，不应加入源码交付或公开静态目录。其媒体仅由受约束的 API 路由读取。

## 接口

- `GET /api/ai/config` → `{models:[{id,label}],configured:{deepseek,image},imageModel,region,mode}`。仅表示配置存在，不代表余额/授权验证通过。
- `POST /api/ai/chat` → `{model,messages:[{role,content}],responseFormat?:'json'}`，返回 `{content,model,usage}`。
- `POST /api/ai/images` → `{prompt,size?,workspaceId,idempotencyKey}`，返回任务。每次固定生成一张。
- `GET /api/ai/images/:id` → `{id,status,workspaceId,prompt,size,url?,error?,retryable?,createdAt,updatedAt}`。
- `GET /api/ai/media/:id.png` → 已保存媒体。

状态为 `queued/running/succeeded/failed`。最终 `size` 为实际请求的模型尺寸，前端应另存画布尺寸；例如 1920×1080 请求会按比例映射到 1696×960。

生图创建请求使用稳定 idempotencyKey（建议 run ID）。同一空间和标识只建立一个任务；不同内容复用标识返回 409。提交前写入任务，再保存供应商 task ID，重启后继续轮询。若在付费提交期间进程中断而没有取得供应商 task ID，任务明确标记不确定失败，不自动重新收费。重新生成应是用户明确发起的新任务。

HTTP 错误统一为 `{error:'可展示的信息'}`。不向前端透传供应商原始错误、鉴权头、服务端路径。模型聊天不自动重试，图片创建不自动重试；已有供应商任务的查询和下载可以有限重试，耗尽后由相同幂等键恢复查询，不重复提交；模型输出的 JSON 和实际编辑范围还必须由前端/领域层验证后才能应用。

参考官方协议（2026-11-11核查）：

- https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
- https://api-docs.deepseek.com/zh-cn/guides/tool_calls/
- https://docs.bailian.console.aliyun.com/zh/model-studio/text-to-image-v2-api-reference

验证：`npx vitest run tests/ai-server.test.ts --coverage --coverage.include='server/*.mjs'`。

## 真实视频生成（2026-11-16）

- 文生视频默认 `wan2.6-t2v`；首帧图生视频默认 `wan2.6-i2v`。使用现有百炼密钥、地域和业务空间域名，不跨区或跨模型自动降级。`WAN_VIDEO_MODEL` / `WAN_VIDEO_IMAGE_MODEL` 当前仅允许这两个已验证协议的型号。
- `POST /api/ai/videos`：`{prompt,workspaceId,idempotencyKey,duration?:5|10|15,size?,referenceImage?}`。默认 5 秒、1280×720。提示词与风格规范总长最多 1500 字。支持 720P/1080P 横屏、竖屏、方屏、4:3、3:4 的协议尺寸。
- `referenceImage` 可为平台生成图片 `/api/ai/media/:id.png`（服务端读取并转 Base64，最多20 MB），或小型 PNG/JPEG/WebP data URL。图生视频保持首帧比例，size 决定720P/1080P档位；文生视频使用确切size。
- `GET /api/ai/videos/:id` 返回 `queued/running/succeeded/failed` 任务状态、原空间、时长、尺寸、模型、可恢复标记与结果地址。
- `GET|HEAD /api/ai/video-media/:id.mp4` 返回本地持久化 MP4，支持 Range 播放与拖动。只开放已成功任务的文件。
- 任务保存在 `.local/ai/video/tasks`，媒体保存在 `.local/ai/video/media`。同请求键不会重复提交；提交结果不确定时不会自动再收费。已有供应商任务查询/下载失败可重用原请求键恢复，供应商终态失败需显式创建新版本。
- 客户端 `generateVideo` 返回并入库真实视频 Asset；等待取消不取消供应商任务。保持相同 requestKey 可恢复；新提示词和新版本使用新 requestKey，reviewSlot 用于归集同一素材位的版本。
- 测试使用 mock HTTP，不宣称实际账户余额、模型权限或生成质量已验证。

协议来源：[文生视频 API](https://www.alibabacloud.com/help/en/model-studio/legacy-wan-text-to-video-api-reference)、[图生视频 API](https://help.aliyun.com/en/model-studio/legacy-image-to-video-api-reference/)。
