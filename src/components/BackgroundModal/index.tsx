import { useEffect, useRef, useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { Modal } from '../Modal'
import { RequiredMark } from '../RequiredMark'
import styles from './index.module.scss'

type BackgroundModalProps = {
  onClose: () => void
  onAdd: (name: string, url: string) => void
}

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * 添加自定义背景：名称 + 图片地址（或本地图片），确认前先在弹窗里预览。
 * 添加成功后由 StageProvider 落成一张新的背景预设并切过去。
 */
export function BackgroundModal({ onClose, onAdd }: BackgroundModalProps) {
  const [nameDraft, setNameDraft] = useState('')
  // 名称为必填，但不要一打开就飘红：等用户离开过输入框、或者图都选好了才提示
  const [nameTouched, setNameTouched] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [fileName, setFileName] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [status, setStatus] = useState<PreviewStatus>('idle')
  const [error, setError] = useState('')
  const requestRef = useRef(0)
  const objectUrlRef = useRef<string | null>(null)
  // 已经交给舞台的 blob 地址不能再 revoke，否则背景会变空白
  const committedRef = useRef(false)

  const dropObjectUrl = () => {
    if (objectUrlRef.current && !committedRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
  }

  useEffect(() => () => { dropObjectUrl() }, [])

  const clearPreview = () => {
    requestRef.current += 1
    setPreviewUrl('')
    setStatus('idle')
    setError('')
  }

  /** fromFile = 已经是 blob 地址，不用再做协议校验 */
  const runPreview = (value: string, fromFile = false) => {
    const url = value.trim()
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    if (!url) {
      setPreviewUrl('')
      setStatus('idle')
      setError('')
      return
    }
    if (!fromFile) {
      try {
        const parsed = new URL(url, window.location.href)
        if (!/^https?:$/i.test(parsed.protocol)) throw new Error('背景地址必须使用 HTTP 或 HTTPS')
      } catch (cause) {
        setPreviewUrl('')
        setStatus('error')
        setError(cause instanceof Error && cause.message.includes('HTTP')
          ? cause.message
          : '背景地址无效')
        return
      }
    }
    setStatus('loading')
    setError('')
    const image = new Image()
    image.onload = () => {
      if (requestId !== requestRef.current) return
      setPreviewUrl(url)
      setStatus('ready')
    }
    image.onerror = () => {
      if (requestId !== requestRef.current) return
      setPreviewUrl('')
      setStatus('error')
      setError('背景图片加载失败，请检查地址是否正确')
    }
    image.src = url
  }

  const handleUrlChange = (value: string) => {
    setUrlDraft(value)
    setFileName('')
    dropObjectUrl()
    clearPreview()
  }

  const handleFile = (file: File | null) => {
    if (!file) return
    dropObjectUrl()
    const objectUrl = URL.createObjectURL(file)
    objectUrlRef.current = objectUrl
    setFileName(file.name)
    setUrlDraft('')
    clearPreview()
    runPreview(objectUrl, true)
  }

  const trimmedName = nameDraft.trim()
  const nameMissing = trimmedName.length === 0
  // 图都准备好了却卡在名称上，这时候必须点出来，否则用户只看到按钮是灰的
  const showNameHint = nameMissing && (nameTouched || status === 'ready')
  const canAdd = status === 'ready' && Boolean(previewUrl) && !nameMissing

  const handleAdd = () => {
    if (!canAdd) return
    committedRef.current = true
    onAdd(trimmedName, previewUrl)
    onClose()
  }

  return (
    <Modal
      title="添加背景"
      scrollable={false}
      width="min(520px, calc(100vw - 32px))"
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>取消</Button>
          <Button size="lg" onClick={handleAdd} disabled={!canAdd}>添加背景</Button>
        </>
      )}
    >
      <label className={styles.field}>
        <span>背景名称<RequiredMark /></span>
        <Input
          size="lg"
          type="text"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={() => setNameTouched(true)}
          placeholder="例如：深夜书房"
          aria-label="背景名称"
          aria-invalid={showNameHint || undefined}
          aria-describedby={showNameHint ? 'background-name-hint' : undefined}
          maxLength={20}
        />
        {/* 提示放在 label 里面：点提示文字也能聚焦到输入框 */}
        {showNameHint && <div className={styles.fieldHint} id="background-name-hint">请填写背景名称</div>}
      </label>

      <label className={styles.field}>
        <span>背景图地址</span>
        <div className={styles.urlRow}>
          <Input
            size="lg"
            type="url"
            value={urlDraft}
            onChange={(event) => handleUrlChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && runPreview(urlDraft)}
            placeholder="粘贴背景图 URL"
            aria-label="背景图地址"
          />
          <Button size="lg" onClick={() => runPreview(urlDraft)} disabled={!urlDraft.trim() || status === 'loading'}>
            预览
          </Button>
        </div>
      </label>

      <div className={styles.fileRow}>
        <label className={styles.fileLabel}>
          <span>选择本地图片</span>
          <input type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} />
        </label>
        {fileName && <span className={styles.fileName} title={fileName}>{fileName}</span>}
      </div>

      <div className={styles.previewBox}>
        {previewUrl
          ? <img className={styles.previewImage} src={previewUrl} alt="背景预览" />
          : (
            <span className={styles.placeholder}>
              {status === 'loading' ? '正在加载预览...' : status === 'error' ? '预览失败' : '填好地址或选一张本地图片后显示预览'}
            </span>
          )}
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </Modal>
  )
}
