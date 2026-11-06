import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_OPTIONS,
  validateText,
  validateLogo,
  loadLogo,
  contrastRatio,
  generateQR,
  downloadQR,
  shareQR,
} from './lib/qr.js';

function Icon({ name, size = 18, ...props }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...props };
  const paths = {
    upload: <><path d="M12 15V4m0 0L8 8m4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></>,
    download: <><path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M5 17v3h14v-3"/></>,
    share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4m-7.5 7 7.5 4.4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
}

function App() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('qr-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
    catch { return 'light'; }
  });
  const [colorOpen, setColorOpen] = useState(false);
  const [colorDraft, setColorDraft] = useState(DEFAULT_OPTIONS.foreground);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('qr-theme', theme); } catch { /* Storage is optional. */ }
  }, [theme]);
  const [text, setText] = useState('');
  const [foreground, setForeground] = useState(DEFAULT_OPTIONS.foreground);
  const [logo, setLogo] = useState(null);
  const [logoName, setLogoName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const uploadGeneration = useRef(0);
  const fileInput = useRef(null);
  const actionTimer = useRef(null);

  const validation = useMemo(() => validateText(text, logo ? 'H' : 'M'), [text, logo]);
  const contrastValue = contrastRatio(foreground, DEFAULT_OPTIONS.background);
  const lowContrast = contrastValue < 4.5;
  const palette = logo?.colors || [];

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
          errorCorrectionLevel: 'M',
          logo: logo?.dataUrl || null,
        });
        if (generation.current === ticket) {
          setResult(next);
          setRendering(false);
        }
      } catch (error) {
        if (generation.current === ticket) {
          setResult({ error: error?.message || 'We couldn’t create this QR code.' });
          setRendering(false);
        }
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text, foreground, logo, uploading, validation.valid]);

  useEffect(() => () => {
    if (actionTimer.current) window.clearTimeout(actionTimer.current);
  }, []);

  const announce = (nextMessage) => {
    if (actionTimer.current) window.clearTimeout(actionTimer.current);
    setMessage(nextMessage);
    actionTimer.current = window.setTimeout(() => setMessage(''), 3600);
  };

  const invalidate = () => {
    generation.current += 1;
    setResult(null);
    setRendering(false);
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
      announce(error);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }

    setUploading(true);
    setLogo(null);
    setLogoName(file.name);
    try {
      const decoded = await loadLogo(file);
      if (uploadGeneration.current !== uploadTicket) return;
      setLogo(decoded);
      setLogoName(file.name);

      const primaryColor = decoded.colors.find(color => contrastRatio(color, DEFAULT_OPTIONS.background) >= 4.5);
      setForeground(primaryColor || DEFAULT_OPTIONS.foreground);
      setUploading(false);
    } catch (error) {
      if (uploadGeneration.current !== uploadTicket) return;
      setLogo(null);
      setLogoName('');
      setUploading(false);
      announce(error?.message || 'This logo couldn’t be opened. Try a PNG or JPEG.');
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
  };

  const handleText = (value) => {
    invalidate();
    setText(value);
    setMessage('');
  };

  const readyResult = result && !result.error && validation.valid && !uploading;
  const doAction = async (work, successMessage) => {
    if (!readyResult) return;
    try {
      const completed = await work(result);
      if (completed !== false) announce(successMessage);
    } catch (error) {
      announce(error?.message || 'That action couldn’t be completed.');
    }
  };

  return (
    <div className="app-shell" onKeyDown={event => { if (event.key === 'Escape') setColorOpen(false); }}>
      <header className="site-header">
        <a className="brand" href="#main" aria-label="Custom QR code generator">
          <svg className="brand-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h3v3h3v3h-6v-6Zm6 0v3"/></svg>
          <span>Custom QR</span>
        </a>
        <button className="icon-button theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/></svg>}
        </button>
      </header>
      <main className="workspace" id="main">
        <section className="editor-card" aria-label="QR code details">
          <div className="content-control">
            <label className="field-label" htmlFor="qr-content">Text or URL</label>
            <textarea id="qr-content" value={text} onChange={event => handleText(event.target.value)} placeholder="https://example.com" rows={3} maxLength={10000} aria-invalid={text.length > 0 && !validation.valid} aria-describedby={text.length > 0 && !validation.valid ? 'content-error' : undefined}/>
            {text.length > 0 && !validation.valid && <p className="inline-error" id="content-error" role="alert">{validation.error}</p>}
          </div>
          <div className="logo-control">
            <span className="field-label">Logo <span className="optional">(optional)</span></span>
            {!logo && !uploading ? <button type="button" className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => fileInput.current?.click()} onDragOver={event => {event.preventDefault();setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={event => {event.preventDefault();setDragging(false);acceptFile(event.dataTransfer.files?.[0]);}}><Icon name="upload" size={17}/><span>Upload logo</span><small>PNG, JPG</small></button> : <div className="logo-loaded"><span className="logo-thumb">{logo?.dataUrl ? <img src={logo.dataUrl} alt="Uploaded logo"/> : <span className="upload-spinner"/>}</span><span className="logo-file">{logoName}</span><button type="button" className="icon-button" aria-label="Remove logo" onClick={removeLogo}><Icon name="close" size={16}/></button></div>}
            <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={event => acceptFile(event.target.files?.[0])} aria-label="Choose logo file"/>
          </div>
          <div className="color-control">
            <span className="field-label">Color</span>
            <div className="color-options">
              <div className="color-picker-wrap">
                <button type="button" className="selected-color" aria-label="Change QR color" aria-expanded={colorOpen} onClick={() => {setColorDraft(foreground);setColorOpen(!colorOpen);}}><span className="selected-color-dot" style={{background:foreground}}/><span>{foreground.toUpperCase()}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
                {colorOpen && <div className="color-popover" role="dialog" aria-label="Color picker"><div className="color-popover-fields"><input type="color" value={/^#[0-9a-f]{6}$/i.test(colorDraft) ? colorDraft : foreground} aria-label="Color spectrum" onChange={event => setColorDraft(event.target.value)}/><input type="text" value={colorDraft} aria-label="Hex color" spellCheck={false} maxLength={7} onChange={event => setColorDraft(event.target.value)}/></div><button className="button button-secondary" type="button" disabled={!/^#[0-9a-f]{6}$/i.test(colorDraft)} onClick={() => {invalidate();setForeground(colorDraft.toLowerCase());setColorOpen(false);}}>Apply</button></div>}
              </div>
              {palette.length > 1 && <div className="brand-colors" aria-label="Logo colors">{palette.map((color,index) => <button key={`${color}-${index}`} type="button" className={`palette-swatch ${foreground.toLowerCase() === color.toLowerCase() ? 'chosen' : ''}`} style={{background:color}} aria-label={`Use logo color ${color}`} aria-pressed={foreground.toLowerCase() === color.toLowerCase()} onClick={() => {invalidate();setForeground(color);}}/>)}</div>}
            </div>
            {lowContrast && <p className="contrast-note" role="status">Use a darker color for easier scanning.</p>}
          </div>
        </section>
        <section className="preview-card" aria-label="QR code preview" aria-busy={rendering || uploading}>
          <div className={`qr-stage ${!readyResult ? 'empty' : ''}`}>
            {readyResult ? <img className="qr-image" src={result.dataUrl} alt="Generated QR code"/> : <div className="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx=".5"/><rect x="15" y="3" width="6" height="6" rx=".5"/><rect x="3" y="15" width="6" height="6" rx=".5"/><path d="M15 15h3v3h3v3h-6v-6Zm6 0v3"/></svg><span>{result?.error || (rendering || uploading ? 'Generating…' : 'Enter text or a URL')}</span></div>}
          </div>
          <div className="action-row">
            <button type="button" className="button button-primary" disabled={!readyResult} onClick={() => doAction(current => downloadQR(current, 'png'), 'PNG downloaded.')}><Icon name="download" size={16}/>Download PNG</button>
            <button type="button" className="button button-secondary" disabled={!readyResult} onClick={() => doAction(shareQR, 'QR code shared.')}><Icon name="share" size={16}/>Share</button>
          </div>
          <p className="status-message" role="status" aria-live="polite">{message}</p>
        </section>
      </main>
    </div>
  );
}

export default App;
