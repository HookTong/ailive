# App 组件重构总结

## 重构目标
将 App 组件从 725 行、包含 30+ 个 state 的庞大组件拆分为更易维护的架构，降低 props drilling 问题，提高代码可读性和可维护性。

## 采用的方案
使用 **React Context API** 而非第三方状态管理库（Redux/Zustand），原因如下：

1. **项目规模适中** - 没有复杂的异步状态逻辑或大型状态树
2. **无需额外依赖** - 已有 React 18，内置支持
3. **清晰的组件边界** - 每个领域（模型、舞台、语音）有独立 context
4. **更好的 tree-shaking** - 只有需要特定状态的组件订阅它
5. **更易测试** - 可独立 mock 各个 context

## 架构变更

### 新增的 Context 层
创建了 4 个独立的 Context，每个管理一个业务领域：

#### 1. ModelContext (`src/contexts/ModelContext.tsx`)
**职责：** 管理 Live2D 模型相关的状态
- 模型源列表（本地 + 在线）
- 当前激活的模型
- 每个模型的角色状态（动作、表情、大小、位置、语音预设）
- manifest 配置加载

**提供的方法：**
- `setActiveModelId` - 切换当前模型
- `updateActiveCharacter` - 更新当前角色状态
- `addOnlineModel` - 添加在线模型
- `deleteModel` - 删除模型
- `resetActiveCharacter` - 重置角色状态
- `resetVoicePresetForAll` - 重置所有角色的语音预设（当删除预设时）

#### 2. StageContext (`src/contexts/StageContext.tsx`)
**职责：** 管理舞台视觉效果
- 背景图片（URL 和文件上传）
- 粒子效果（开关、预设、强度、速度、透明度、颜色、大小）
- 滤镜效果（开关、预设、亮度、对比度、饱和度、模糊）
- 暗角效果
- 自定义滤镜预设

**提供的方法：**
- `handleBackgroundFile` - 处理背景图片文件
- `handleParticle*Change` - 粒子效果调整
- `handleFilterPresetChange` - 滤镜预设切换
- `addCustomFilterPreset` - 添加自定义滤镜
- `resetStage` - 重置舞台到默认状态

#### 3. VoiceContext (`src/contexts/VoiceContext.tsx`)
**职责：** 管理语音合成（火山 TTS）
- TTS 配置（API 密钥、端点）
- 自定义语音预设
- 当前播放状态
- 错误信息

**提供的方法：**
- `speak` - 合成并播放语音
- `stopSpeaking` - 停止播放
- `addVoice` - 添加自定义语音
- `deleteVoice` - 删除语音预设（通过回调通知 ModelContext）

#### 4. LiveDataContext (`src/contexts/LiveDataContext.tsx`)
**职责：** 管理直播数据
- 抖音房间连接
- 直播快照（守护、礼物、在线状态）
- 房间统计数据

**提供的方法：**
- `handleDouyinRoomChange` - 切换/断开抖音直播间

### 组件简化

#### ControlPanel
**之前：** 21 个 props
**之后：** 0 个 props（全部通过 context 获取）

现在直接通过 hooks 获取状态：
```tsx
const { modelSources, activeModelId, manifest, ... } = useModel()
const { voiceConfig, customVoices, ... } = useVoice()
```

#### StageControlPanel
**之前：** 28 个 props
**之后：** 0 个 props（全部通过 context 获取）

现在直接通过 hooks 获取状态：
```tsx
const { backgroundUrl, particleEnabled, filterEnabled, ... } = useStage()
```

#### App
**之前：** 725 行，30+ 个 useState
**之后：** ~150 行，只负责布局和 context providers

App 组件现在只做两件事：
1. 提供 Context Providers 的嵌套
2. 渲染主布局和各个子组件

### 跨 Context 通信
使用了一个桥接组件 `VoiceAndModelBridge` 来处理 VoiceContext 和 ModelContext 之间的通信：
- 当删除语音预设时，VoiceContext 通过回调通知
- 桥接组件调用 ModelContext 的 `resetVoicePresetForAll` 方法
- 所有使用该预设的角色自动重置为默认预设

## 代码对比

### 之前的 Props Drilling
```tsx
// App.tsx
<StageControlPanel
  backgroundUrl={backgroundUrl}
  onBackgroundUrlChange={setBackgroundUrl}
  onBackgroundFile={handleBackgroundFile}
  // ... 还有 25 个 props
  onAddCustomFilterPreset={handleAddCustomFilterPreset}
/>
```

### 之后的 Context 使用
```tsx
// StageControlPanel.tsx
export function StageControlPanel() {
  const {
    backgroundUrl,
    setBackgroundUrl,
    handleBackgroundFile,
    // ... 直接从 context 获取
  } = useStage()
  
  // 组件逻辑...
}

// App.tsx
<StageControlPanel /> // 无需 props！
```

## 状态管理规则

### 全局状态（放在 Context）
- 需要在多个组件间共享的状态
- 需要持久化到 localStorage 的状态
- 业务逻辑复杂，需要集中管理的状态

### 局部状态（保留在组件）
- UI 临时状态（如模态框开关、输入框草稿）
- 不需要共享的计算结果
- 动画和交互状态

## 文件结构
```
src/
├── contexts/
│   ├── index.tsx                  # 统一导出
│   ├── ModelContext.tsx           # 模型管理
│   ├── StageContext.tsx           # 舞台效果
│   ├── VoiceContext.tsx           # 语音合成
│   └── LiveDataContext.tsx        # 直播数据
├── components/
│   ├── ControlPanel/index.tsx     # 简化后的组件
│   └── StageControlPanel/index.tsx # 简化后的组件
└── App/index.tsx                  # 简化后的 App
```

## 优势总结

### 1. **可维护性提升**
- 每个 Context 文件职责单一，代码在 100-200 行之间
- 组件不再需要理解整个应用的状态结构
- 修改某个领域的逻辑只需关注对应的 Context

### 2. **Props 数量大幅减少**
- ControlPanel: 21 props → 0 props
- StageControlPanel: 28 props → 0 props
- 更少的类型定义和维护成本

### 3. **更好的性能**
- 使用 `useMemo` 避免不必要的 context value 重新创建
- 只有订阅特定 context 的组件才会因该 context 变化而重渲染
- 粒度控制更精确

### 4. **更容易测试**
- 可以独立测试每个 Context Provider
- 可以 mock 特定的 context 来测试组件
- 不需要构建完整的组件树

### 5. **代码复用性**
- Context hooks 可以在任何组件中使用
- 不需要通过 props 一层层传递
- 新增功能时更容易接入现有状态

## 迁移策略
本次重构采用了渐进式迁移：
1. ✅ 创建新的 Context 文件
2. ✅ 创建简化的组件版本（.refactored.tsx）
3. ✅ 测试构建通过
4. ✅ 替换原有文件
5. ✅ 验证功能正常

## 后续改进建议

### 1. 添加 Context DevTools
可以添加一个开发工具来可视化 context 的变化：
```tsx
function ContextDevTools() {
  const model = useModel()
  const stage = useStage()
  // 在开发模式下显示状态
}
```

### 2. 性能优化
如果发现某些组件重渲染过于频繁，可以：
- 将大的 Context 拆分为更小的粒度
- 使用 `React.memo` 包装纯展示组件
- 使用 `useCallback` 包装事件处理函数

### 3. 类型安全增强
考虑使用类型守卫来确保 context 的类型安全：
```tsx
export function useModel(): ModelContextValue {
  const context = useContext(ModelContext)
  if (!context) {
    throw new Error('useModel must be used within ModelProvider')
  }
  return context
}
```

### 4. 状态持久化优化
当前每个 Context 独立处理 localStorage，可以考虑：
- 创建统一的持久化 hook
- 添加错误处理和降级策略
- 支持数据迁移和版本控制

## 总结
这次重构成功将一个 700+ 行、高度耦合的组件拆分为清晰的上下文架构。通过 React Context API，我们在不引入额外依赖的前提下，实现了：
- ✅ 状态管理的分离
- ✅ 组件 props 的简化
- ✅ 代码可维护性的提升
- ✅ 更好的类型安全
- ✅ 保持原有功能完整性

代码现在更易于理解、测试和扩展，为后续功能开发打下了良好的基础。
