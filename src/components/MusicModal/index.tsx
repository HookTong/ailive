import { useEffect, useRef, useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { Modal } from '../Modal'
import { NowPlayingCard } from '../NowPlayingCard'
import { RequiredMark } from '../RequiredMark'
import { Tooltip } from '../Tooltip'
import { useMusic } from '../../hooks'
import styles from './index.module.scss'

type MusicModalProps = {
  onClose: () => void
  /** 添加成功后由 MusicProvider 落成一首自定义音乐并切过去；返回 false 表示地址打不开 */
  onAdd: (name: string, url: string) => Promise<boolean>
}

/**
 * 添加自定义音乐：名称 + 音频地址（或本地文件），可以边填边试听。
 * 名称必填 —— 添加后会变成音乐按钮组里的一个胶囊，没名字就分不清谁是谁。
 *
 * 试听走的是 MusicProvider 里那套独立的试听播放器，舞台上的「正在播放」卡片
 * 不会跟着变；关窗时试听信息一并清掉，下次打开是一张干净的卡片。
 */
export function MusicModal({ onClose, onAdd }: MusicModalProps) {
  const { preview, beginPreview, endPreview } = useMusic()
  const [nameDraft, setNameDraft] = useState('')
  // 名称必填，但不要一打开就飘红：等用户离开过输入框、或者地址都填了才提示
  const [nameTouched, setNameTouched] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  /** 本地文件的对象地址，和手填地址二选一 */
  const [fileUrl, setFileUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [adding, setAdding] = useState(false)
  const objectUrlRef = useRef<string | null>(null)
  // 已经交给播放器的 blob 地址不能再 revoke，否则刚添加的那首会变成哑巴
  const committedRef = useRef(false)
  // 添加成功后主播放器已经在放新加的那首了，关窗时不能再恢复外面的播放
  const keepPlaybackRef = useRef(false)

  const dropObjectUrl = () => {
    if (objectUrlRef.current && !committedRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
  }

  useEffect(() => () => { dropObjectUrl() }, [])

  /**
   * 弹窗开着的时候外面的背景音乐先停一停：进来时记住它原本在不在放，关窗再接着放。
   * 试听本身走独立播放器，所以这里不用管曲目和进度。
   */
  useEffect(() => {
    beginPreview()
    return () => { endPreview(!keepPlaybackRef.current) }
  }, [beginPreview, endPreview])

  /** 实际要播的地址：本地文件优先，其次是手填的 URL */
  const source = fileUrl || urlDraft.trim()
  const trimmedName = nameDraft.trim()
  const nameMissing = trimmedName.length === 0
  // 地址都填好了却卡在名称上，这时候必须点出来，否则用户只看到按钮是灰的
  const showNameHint = nameMissing && (nameTouched || Boolean(source))
  const busy = testing || adding
  const canAdd = !nameMissing && Boolean(source) && !busy

  const handleUrlChange = (value: string) => {
    setUrlDraft(value)
    setFileName('')
    setFileUrl('')
    dropObjectUrl()
    setError('')
  }

  /** 试听统一走这里，成功与否都反映到弹窗的错误文案上 */
  const playPreview = async (url: string, fallbackName?: string) => {
    if (!url || busy) return
    setTesting(true)
    setError('')
    const ok = await preview.start(url, fallbackName || trimmedName || undefined)
    setTesting(false)
    if (!ok) setError('音乐加载失败，请检查地址是否正确')
  }

  const handleFile = (file: File | null) => {
    if (!file) return
    dropObjectUrl()
    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setFileName(file.name)
    setFileUrl(objectUrl)
    setUrlDraft('')
    setError('')
    // 选完就放：用户挑文件本来就是为了听一下，不该再让他点一次 ▶。
    // 名字去掉扩展名，卡片上显示得干净些
    void playPreview(objectUrl, file.name.replace(/\.[^.]+$/, ''))
  }

  const handlePreview = () => {
    void playPreview(source)
  }

  const handleAdd = async () => {
    if (!canAdd) return
    setAdding(true)
    setError('')
    const ok = await onAdd(trimmedName, source)
    setAdding(false)
    if (!ok) {
      setError('音乐加载失败，请检查地址是否正确')
      return
    }
    committedRef.current = true
    keepPlaybackRef.current = true
    onClose()
  }

  return (
    <Modal
      title="添加音乐"
      scrollable={false}
      width="min(520px, calc(100vw - 32px))"
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>取消</Button>
          <Button size="lg" onClick={() => void handleAdd()} disabled={!canAdd}>
            {adding ? '添加中…' : '添加音乐'}
          </Button>
        </>
      )}
    >
      <label className={styles.field}>
        <span>音乐名称<RequiredMark /></span>
        <Input
          size="lg"
          type="text"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={() => setNameTouched(true)}
          placeholder="例如：深夜电台"
          aria-label="音乐名称"
          aria-invalid={showNameHint || undefined}
          aria-describedby={showNameHint ? 'music-name-hint' : undefined}
          maxLength={20}
        />
        {/* 提示放在 label 里面：点提示文字也能聚焦到输入框 */}
        {showNameHint && <div className={styles.fieldHint} id="music-name-hint">请填写音乐名称</div>}
      </label>

      <label className={styles.field}>
        <span>音乐地址</span>
        <div className={styles.urlRow}>
          <Input
            size="lg"
            type="url"
            value={urlDraft}
            onChange={(event) => handleUrlChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') handlePreview() }}
            placeholder="粘贴音频 URL"
            aria-label="音乐地址"
          />
          <Tooltip placement="top" title="试听这段音乐">
            <Button
              size="lg"
              aria-label="试听"
              onClick={handlePreview}
              disabled={!source || busy}
            >
              {testing ? '…' : '▶'}
            </Button>
          </Tooltip>
        </div>
      </label>

      <div className={styles.fileRow}>
        <label className={styles.fileLabel}>
          <span>选择本地音乐</span>
          <input type="file" accept="audio/*" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} />
        </label>
        {fileName && <span className={styles.fileName} title={fileName}>{fileName}</span>}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* 底部试听卡片：只反映试听播放器，跟舞台上的背景音乐互不影响。
          还没试听过时是一张空卡片，不显示上一首的残影 */}
      <div className={styles.preview}>
        <NowPlayingCard
          status={preview.playing ? '正在播放' : preview.track.url ? '已暂停' : '等待试听'}
          title={preview.track.name || '尚未选择音乐'}
          elapsed={preview.currentTime}
          duration={preview.duration}
          playing={preview.playing}
          analyser={preview.analyser}
          // 没有可播的东西时不给 onToggle，圆环就只是个装饰
          onToggle={preview.track.url ? preview.toggle : undefined}
        />
      </div>
    </Modal>
  )
}
