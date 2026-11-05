import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_OPTIONS,
  validateText,
  validateLogo,
  loadLogo,
  contrastRatio,
  generateQR,
  downloadQR,
  copyQR,
  shareQR,
} from './lib/qr.js';

const PALETTE = [
  { name: 'Moss', value: '#173f35' },
  { name: 'Ink', value: '#202b28' },
  { name: 'Ocean', value: '#315f72' },
  { name: 'Clay', value: '#a2573f' },
  { name: 'Plum', value: '#6d506c' },
  { name: 'Olive', value: '#66734e' },
];
const SIZES = [512, 1024, 2048];

function Icon({ name, size = 18, ...props }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...props };
  const paths = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M14 14h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z"/></>,
    upload: <><path d="M12 15V4m0 0L8 8m4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></>,
    download: <><path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M5 17v3h14v-3"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4m-7.5 7 7.5 4.4"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    check: <path d="m5 12 4.5 4.5L19 7"/>,
    sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
    shield: <><path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
}

function App() {
  const [contentType, setContentType] = useState('url');
  const [text, setText] = useState('');
  const [foreground, setForeground] = useState(DEFAULT_OPTIONS.foreground);
  const [background, setBackground] = useState(DEFAULT_OPTIONS.background);
  const [size, setSize] = useState(DEFAULT_OPTIONS.size);
  const [level, setLevel] = useState(DEFAULT_OPTIONS.errorCorrectionLevel);
  const [logo, setLogo] = useState(null);
  const [logoName, setLogoName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [action, setAction] = useState({ kind: 'idle', message: '' });
  const [format, setFormat] = useState('png');
  const generation = useRef(0);
  const uploadGeneration = useRef(0);
  const fileInput = useRef(null);
  const actionTimer = useRef(null);
  const effectiveLevel = logo ? 'H' : level;
  const validation = useMemo(() => validateText(text, effectiveLevel), [text, effectiveLevel]);
  const byteCount = validation.bytes;
  const contrastValue = contrastRatio(foreground, background);
  const lowContrast = contrastValue < 4.5;
  const invalidate = useCallback(() => {
    generation.current += 1;
    setResult(null);
    setRendering(false);
  }, []);

  useEffect(() => {
    const ticket = generation.current + 1;
    generation.current = ticket;
    setResult(null);
    if (!text.trim() || !validation.valid || uploading) {
      setRendering(false);
      return undefined;
    }
    setRendering(true);
    const timer = window.setTimeout(async () => {
      try {
        const next = await generateQR(text, {
          ...DEFAULT_OPTIONS,
          foreground,
          background,
          size,
          errorCorrectionLevel: level,
          logo: logo?.dataUrl || null,
        });
        if (generation.current === ticket) {
          setResult(next);
          setRendering(false);
          setAction({ kind: 'success', message: 'Your QR code is ready.' });
        }
      } catch (error) {
        if (generation.current === ticket) {
          setResult({ error: error?.message || 'We couldn’t create this QR code.' });
          setRendering(false);
          setAction({ kind: 'error', message: error?.message || 'We couldn’t create this QR code.' });
        }
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [text, foreground, background, size, level, logo, uploading, validation.valid]);

  useEffect(() => () => {
    if (actionTimer.current) window.clearTimeout(actionTimer.current);
  }, []);

  const announce = (kind, message) => {
    if (actionTimer.current) window.clearTimeout(actionTimer.current);
    setAction({ kind, message });
    if (kind === 'success') actionTimer.current = window.setTimeout(() => setAction({ kind: 'idle', message: '' }), 3600);
  };

  const handleText = (value) => {
    invalidate();
    setText(value);
    setAction({ kind: 'idle', message: '' });
  };

  const acceptFile = async (file) => {
    if (!file) return;
    invalidate();
    const uploadTicket = ++uploadGeneration.current;
    const error = validateLogo(file);
    if (error) {
      setUploading(false);
      setLogo(null);
      setLogoName('');
      announce('error', error);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setUploading(true);
    setLogo(null);
    setLogoName(file.name);
    announce('idle', 'Preparing your logo…');
    try {
      const decoded = await loadLogo(file);
      if (uploadGeneration.current !== uploadTicket) return;
      setLogo(decoded);
      setUploading(false);
      announce('success', 'Logo added to your QR code.');
    } catch (error) {
      if (uploadGeneration.current !== uploadTicket) return;
      setLogo(null);
      setLogoName('');
      setUploading(false);
      announce('error', error?.message || 'This logo couldn’t be opened. Try a PNG or JPEG.');
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removeLogo = () => {
    uploadGeneration.current += 1;
    invalidate();
    setUploading(false);
    setLogo(null);
    setLogoName('');
    if (fileInput.current) fileInput.current.value = '';
    announce('idle', 'Logo removed.');
  };

  const clearAll = () => {
    uploadGeneration.current += 1;
    invalidate();
    setText('');
    setLogo(null);
    setLogoName('');
    setUploading(false);
    setAction({ kind: 'idle', message: '' });
    if (fileInput.current) fileInput.current.value = '';
  };

  const resetAll = () => {
    clearAll();
    setContentType('url');
    setForeground(DEFAULT_OPTIONS.foreground);
    setBackground(DEFAULT_OPTIONS.background);
    setSize(DEFAULT_OPTIONS.size);
    setLevel(DEFAULT_OPTIONS.errorCorrectionLevel);
    setFormat('png');
  };

  const readyResult = result && !result.error && validation.valid && !uploading;
  const doAction = async (kind, work, successMessage) => {
    if (!readyResult) return;
    try {
      const completed = await work(result);
      if (completed !== false) announce('success', successMessage);
    } catch (error) {
      announce('error', error?.message || 'That action couldn’t be completed.');
    }
  };
  const download = () => doAction('download', (current) => downloadQR(current, format), `${format.toUpperCase()} download started.`);
  const copy = () => doAction('copy', copyQR, 'QR code copied to clipboard.');
  const share = () => doAction('share', shareQR, 'QR code shared.');
  const shareAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const palette = logo?.colors || [];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Studio navigation">
        <a className="brand" href="#main" aria-label="a. almenber CREATIVE TOOLS">
          <span className="brand-mark" aria-hidden="true">a.</span>
          <span className="brand-copy"><strong>almenber</strong><small>CREATIVE TOOLS</small></span>
        </a>
        <div className="sidebar-rule" />
        <p className="side-label">WORKSPACE</p>
        <div className="nav-item active" aria-current="page"><Icon name="grid" size={18}/><span>QR Studio</span><i /></div>
        <div className="sidebar-bottom">
          <span className="privacy-icon"><Icon name="shield" size={17}/></span>
          <div><strong>Private by design</strong><span>Your content stays here.</span></div>
        </div>
      </aside>

      <main className="main-area" id="main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Tools</span><span className="crumb-slash">/</span><strong>QR Studio</strong></div>
          <div className="topbar-note"><span className="online-dot"/> Works offline</div>
        </header>

        <div className="workspace">
          <section className="page-heading">
            <div><p className="eyebrow">ALMENBER / QR STUDIO</p><h1>Make it <em>scannable.</em></h1><p className="heading-copy">A considered QR code, made in moments. Your content never leaves this device.</p></div>
            <div className="heading-decoration" aria-hidden="true"><span/><span/><span/><span/><span/><span/><span/><span/><span/></div>
          </section>

          <div className="studio-grid">
            <section className="controls-column" aria-label="QR code settings">
              <section className="panel content-panel">
                <div className="panel-heading"><span className="step-number">01</span><div><h2>Your content</h2><p>Choose what your QR code opens.</p></div></div>
                <div className="segmented" role="group" aria-label="Content type">
                  <button type="button" aria-pressed={contentType === 'url'} className={contentType === 'url' ? 'selected' : ''} onClick={() => setContentType('url')}> <span className="tab-symbol">↗</span> URL</button>
                  <button type="button" aria-pressed={contentType === 'text'} className={contentType === 'text' ? 'selected' : ''} onClick={() => setContentType('text')}><span className="tab-symbol">T</span> Plain text</button>
                </div>
                <label className="field-label" htmlFor="qr-content">{contentType === 'url' ? 'Destination URL' : 'Your message'}<span className="optional">{contentType === 'text' ? 'Any language is welcome' : 'Include https:// for best results'}</span></label>
                <textarea id="qr-content" value={text} onChange={(event) => handleText(event.target.value)} placeholder={contentType === 'url' ? 'https://yourwebsite.com' : 'Type a message to share…'} rows={contentType === 'url' ? 2 : 4} maxLength={10000} aria-invalid={text.length > 0 && !validation.valid} aria-describedby={text.length > 0 && !validation.valid ? 'content-meta content-error' : 'content-meta'} spellCheck={contentType === 'text'} />
                <div className="field-meta" id="content-meta"><span>{byteCount.toLocaleString()} UTF-8 bytes</span><span>{validation.maxBytes.toLocaleString()} in byte mode</span></div>
                {text.length > 0 && !validation.valid && <p className="inline-error" id="content-error" role="alert">{validation.error}</p>}
                {text.trim() && validation.valid && <p className="capacity-note"><span className="capacity-check"><Icon name="check" size={12}/></span> Fits within the selected error correction capacity.</p>}
                {readyResult && <a className="mobile-preview-link" href="#preview">View your QR code ↓</a>}
              </section>

              <section className="panel logo-panel">
                <div className="panel-heading"><span className="step-number">02</span><div><h2>Make it yours</h2><p>Add a mark at the heart of your code.</p></div><span className="optional-pill">OPTIONAL</span></div>
                {!logo && !uploading ? <button type="button" className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => fileInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }}>
                  <span className="upload-icon"><Icon name="upload" size={19}/></span><span><strong>Drop your logo here</strong><small>or <u>browse files</u></small></span><span className="file-hint">PNG or JPG · up to 2 MB</span>
                </button> : <div className="logo-loaded">
                  <span className="logo-thumb">{logo?.dataUrl ? <img src={logo.dataUrl} alt=""/> : <span className="upload-spinner"/>}</span>
                  <span className="logo-file"><strong>{logoName || 'Preparing logo…'}</strong><small>{logo ? `${logo.width} × ${logo.height} pixels` : 'Checking image…'}</small></span>
                  {logo && <button type="button" className="icon-button remove-button" aria-label="Remove logo" onClick={removeLogo}><Icon name="close"/></button>}
                </div>}
                <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={(event) => acceptFile(event.target.files?.[0])} aria-label="Choose logo file" />
                {palette.length > 0 && <div className="logo-palette"><span>FROM YOUR LOGO</span><div>{palette.slice(0, 6).map((color, index) => <button type="button" key={`${color}-${index}`} className="palette-swatch" style={{ '--swatch': color }} aria-label={`Use logo color ${color} as foreground`} title={color} onClick={() => { invalidate(); setForeground(color); }}/>)}</div></div>}
                {logo && palette.length === 0 && <p className="helper-note">Choose a color below to coordinate with your logo.</p>}
              </section>

              <section className="panel style-panel">
                <div className="panel-heading"><span className="step-number">03</span><div><h2>Fine tune</h2><p>Set the colors and finish.</p></div></div>
                <div className="color-row">
                  <label className="color-setting"><span className="color-title">Foreground</span><span className="color-input-wrap"><input type="color" value={foreground} aria-label="Foreground color" onChange={(event) => { invalidate(); setForeground(event.target.value); }}/><span className="color-hex">{foreground.toUpperCase()}</span></span></label>
                  <label className="color-setting"><span className="color-title">Background</span><span className="color-input-wrap"><input type="color" value={background} aria-label="Background color" onChange={(event) => { invalidate(); setBackground(event.target.value); }}/><span className="color-hex">{background.toUpperCase()}</span></span></label>
                </div>
                <div className="quick-colors"><span>QUICK COLORS</span><div>{PALETTE.map((item) => <button type="button" key={item.value} className={`palette-swatch ${foreground.toLowerCase() === item.value ? 'chosen' : ''}`} style={{ '--swatch': item.value }} aria-label={`Set foreground to ${item.name}`} title={item.name} onClick={() => { invalidate(); setForeground(item.value); }}/>)}</div></div>
                <div className="select-row">
                  <div><span className="field-label">Export size</span><div className="size-control" role="group" aria-label="Export size">{SIZES.map((option) => <button type="button" key={option} aria-pressed={size === option} className={size === option ? 'active' : ''} onClick={() => { invalidate(); setSize(option); }}>{option}</button>)}</div></div>
                  <label><span className="field-label">Error correction</span><select value={level} onChange={(event) => { invalidate(); setLevel(event.target.value); }}><option value="L">Low · 7%</option><option value="M">Medium · 15%</option><option value="Q">Quartile · 25%</option><option value="H">High · 30%</option></select></label>
                </div>
                {logo && level !== 'H' && <p className="helper-note">High correction is used automatically while a logo is added.</p>}
                <p className={`contrast-note ${lowContrast ? 'low-contrast' : ''}`} role="status"><span className="contrast-dot"/> {lowContrast ? `Low contrast (${contrastValue.toFixed(1)}:1). Choose a darker foreground or lighter background for easier scanning.` : `Good contrast (${contrastValue.toFixed(1)}:1) for reliable scanning.`}</p>
              </section>
              <div className="reset-row"><button type="button" className="text-button" onClick={clearAll}>Clear content</button><span>·</span><button type="button" className="text-button" onClick={resetAll}>Reset all settings</button></div>
            </section>

            <aside className="preview-column" id="preview" aria-label="QR code preview">
              <div className="preview-card">
                <div className="preview-header"><div><span className="preview-label">LIVE PREVIEW</span><span className="preview-quality">{size}px <span>·</span> {effectiveLevel} correction</span></div><span className={`preview-status ${readyResult ? 'ready' : rendering ? 'working' : ''}`}><i/>{readyResult ? 'Ready' : rendering || uploading ? 'Updating' : 'Waiting'}</span></div>
                <div className={`qr-stage ${!readyResult ? 'empty' : ''}`} style={{ '--qr-bg': background }}>
                  {readyResult ? <img className="qr-image" src={result.dataUrl} alt={`QR code for ${contentType === 'url' ? 'URL' : 'text'}`} /> : <div className="empty-state"><div className="empty-ornament" aria-hidden="true"><span/><span/><span/><span/><span/><span/><span/><span/><span/></div><span className="empty-spark"><Icon name="sparkle" size={19}/></span><strong>{result?.error ? 'Couldn’t make this code' : rendering || uploading ? 'Preparing your code' : 'Your code starts here'}</strong><p>{result?.error || (rendering || uploading ? 'Updating your preview…' : 'Add content to see your QR code appear.')}</p></div>}
                </div>
                <div className="preview-footer"><div className="scan-info"><span className="scan-icon"><Icon name="grid" size={15}/></span><span><strong>Made to be scanned</strong><small>Test before printing or sharing</small></span></div><span className="corner-mark" aria-hidden="true">a.</span></div>
                <div className="export-divider"/>
                <div className="export-controls"><div className="format-switch" role="group" aria-label="Download format"><button type="button" className={format === 'png' ? 'active' : ''} aria-pressed={format === 'png'} onClick={() => setFormat('png')}>PNG</button><button type="button" className={format === 'svg' ? 'active' : ''} aria-pressed={format === 'svg'} onClick={() => setFormat('svg')}>SVG</button></div><button type="button" className="button button-primary download-button" disabled={!readyResult} onClick={download}><Icon name="download" size={17}/> Download {format.toUpperCase()}</button></div>
                <div className="secondary-actions"><button type="button" className="button button-secondary" disabled={!readyResult} onClick={copy}><Icon name="copy" size={16}/> Copy</button><button type="button" className="button button-secondary" disabled={!readyResult || !shareAvailable} onClick={share} title={!shareAvailable ? 'Sharing isn’t available in this browser' : undefined}><Icon name="share" size={16}/> Share</button></div>
                <p className={`status-message ${action.kind}`} role="status" aria-live="polite">{action.message || (readyResult ? 'Your code is ready to save or share.' : 'Your content stays on this device.')}</p>
              </div>
              <div className="privacy-card"><span className="privacy-emblem"><Icon name="shield" size={17}/></span><p><strong>Made privately.</strong> Your text and logo are never saved or sent anywhere.</p></div>
              <div className="preview-footnote"><span>CRAFTED FOR CLARITY</span><span>✳</span><span>ALMENBER TOOLS</span></div>
            </aside>
          </div>
          <footer className="page-footer"><span>© 2026 almenber</span><span>Thoughtful tools for everyday work</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
