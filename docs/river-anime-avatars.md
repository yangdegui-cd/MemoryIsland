# 时光长河二次元角色（2026-10-27）

用户选定预览中的 1、2 号：VRoid 官方样本 C 对应 Alexx，样本 B 对应 BV。

- Alexx：鲜红头发、红色上衣、长裤与鞋子；保留面料纹理和少量浅色饰边。
- BV：紫色为主的衣服，原有紫黑长发；胸臀轮廓适度增加，服装和身体使用同一个平滑变形场。骨骼与四肢长度保持原始比例。
- 两个角色均使用真正的 `Sprint_Loop_Rig`，通过源模型与目标模型的静止姿势转换关节旋转。保留跑步的竖直重心变化，只去除水平根位移。Idle 与 Run 随速度混合，头发由 VRM spring bones 更新。

入口 `app/river/characters.ts` 根据现有登录身份选择资源；`avatar.ts` 统一负责 VRM、配色、轮廓与动作绑定。场景仍固定人物纵向位置，由道路滚动产生移动感。保留左右移动、F 门交互与背景视频。

资源与许可说明见 `public/models/river-avatar-NOTICE.txt`。原始 VRM 没有改写，颜色与轮廓调整由运行时代码应用。需要在其他软件看到修改后的造型时应另行导出，不能把原始 VRM 误认为改色后的导出文件。

本地选型预览 `design/previews/anime-run-2026-10-27` 使用同一个 avatar.ts 的转译版本，启动 `python3 serve.py` 后访问 http://127.0.0.1:8767/。正式功能在 `/river`，不依赖预览服务。

验证：Node 22 下 TypeScript 检查、生产构建，以及角色/移动/道路 10 项测试通过。浏览器确认两套配色、侧面跑步和 BV 轮廓；已在登录 Alexx 的本地 `/river` 核对模型、跑步、固定纵向位置与道路反向滚动。视觉观感仍以用户实际体验为准。

已随网站发布更新上线 https://island.ydgui.com/river。外网浏览器确认加载 `vroid-anime-rig` / `Sprint_Loop_Rig`，检查 W/S/A/D 输入与松键回到 Idle，控制台无错误；新 VRM 资源返回 HTTP 200。验收截图保存在本地忽略目录 `outputs/river-anime/`。线上测试使用当前登录的 Alexx；BV 在共享加载器的角色预览中检查，未切换用户账号。
