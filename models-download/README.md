# DeepSeek 鲸鱼娘 Live2D 模型包

## 当前打包版本

**文件**: `DS-Whale-Live2D-Model.zip` (3.05 MB)

### 模型信息

| 项目 | 内容 |
|------|------|
| **模型名称** | DS 鲸鱼娘 (DeepSeek Whale Girl) |
| **模型文件** | `c_0120.model3.json` |
| **核心文件** | `c_0120.moc3` (2.1 MB) |
| **纹理贴图** | 2 张 PNG (2048x2048) |
| **动作数量** | 8 个 |
| **表情数量** | 55 个 |
| **物理系统** | 已配置 |

### 动作列表

| 动作 | 文件 | 说明 |
|------|------|------|
| idle | idle.motion3.json | 待机（猫爪循环）|
| aidale | _aidale.motion3.json | 伸展 |
| selfie | 自拍.motion3.json | 自拍 |
| selfieQuick | 自拍简单.motion3.json | 快速自拍 |
| ketchup | 番茄酱.motion3.json | 挤番茄酱 |
| openLid | 开盖.motion3.json | 开盖 |
| bubble | chuipaopao.motion3.json | 吹泡泡糖 |
| splash | 喷水.motion3.json | 鲸鱼喷水 |

### 表情列表（部分）

爱心眼、星星眼、脸红、哭、生气、调皮、开心兴奋、悲伤、晕晕、吐舌、吐魂、流汗、呆呆眼、闭眼口水、心跳、感叹号、问号、阴暗、love、兔兔贴纸、单边马尾、双手比耶、圆眼镜、方眼镜、椭圆眼镜、墨镜、头箍、巴菲、情绪花花、手机换色、挤、撤回、橡皮、深色桌布、点菜按下、猫猫贴纸、画笔、蛋包饭、蝴蝶结贴纸、魔爪、魔爪换色、鲸鱼、鲸鱼放桌上...

### 版权信息

- **模型作者**: B站 @氵六青 (uid 11272072)
- **角色原作**: 上善无形（溟月）→ ZipZipPipe（DeepSeek 女仆二创）
- **来源仓库**: https://github.com/Andersen216/dsh-whale-girl-live2d
- **授权许可**: CC BY-NC-SA 4.0（署名 · 非商业 · 相同方式共享）
- **禁止**: 盗用与出售

---

## 其他可用版本

由于当前网络环境限制，GitHub Release 无法直接下载。以下链接需要你在浏览器中手动访问下载：

### 版本 1: DeepSeek娘 Live2D v4z7（推荐，最丰富）

| 项目 | 内容 |
|------|------|
| **作者** | donkyi（皮套制作） |
| **下载** | https://github.com/jingshendegege/deepseek-niang-live2d/releases/tag/v4z7 |
| **文件名** | `DeepSeekNiang-v4z7.zip` (376 MB) |
| **表情数** | 38 个 |
| **特色** | 含 .cmo3 源文件，支持面捕，可换发色/眼色 |
| **许可** | CC BY-NC-SA 4.0，禁止商用 |

### 版本 2: DSH 桌宠 Live2D版

| 项目 | 内容 |
|------|------|
| **作者** | deanzhang2026-max |
| **下载** | https://github.com/deanzhang2026-max/dsh-lived-pet/releases/tag/v1.1.0 |
| **文件名** | `DSH桌宠_Live2D版.zip` (约 150 MB) |
| **表情数** | 44 个 |
| **特色** | 含完整 Electron 桌宠程序，16 种状态联动 |
| **许可** | 模型版权 @氵六青，代码 MIT |

### 版本 3: 迅雷网盘（手机桌宠）

| 项目 | 内容 |
|------|------|
| **来源** | 百度贴吧分享 |
| **链接** | https://pan.xunlei.com/s/VP-xidkRcDSsE7uE6goXJg__A1 |
| **说明** | 手机安装的大肥鱼桌宠教程+资源包 |

### 版本 4: B站 @Mao绒绒家园 大肥鱼公皮

| 项目 | 内容 |
|------|------|
| **作者** | B站 @Mao绒绒家园 (UID 431301506) |
| **视频** | https://www.bilibili.com/video/BV1yep465EQz |
| **类型** | 免费公皮，Q版/全身两种 |
| **获取** | 视频页面通常含下载链接或网盘 |

---

## 如何在 VTube Studio 中使用

1. 解压 `DS-Whale-Live2D-Model.zip`
2. 将 `whale/` 文件夹放入 VTube Studio 的 `Live2DModels/` 目录
3. 在 VTube Studio 中重新扫描模型
4. 选择 "DS 鲸鱼娘" 即可使用

## 如何在网页项目中使用

参考当前项目的 `Live2DCanvas.tsx` 组件，使用 `pixi-live2d-display` 库加载：

```typescript
import { Live2DModel } from 'pixi-live2d-display'
const model = await Live2DModel.from('/models/whale/c_0120.model3.json')
```

---

*模型资源版权归原作者所有，请遵守各自的授权条款使用。*
