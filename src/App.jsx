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
  copyQR,
  canShareQR,
} from './lib/qr.js';

function Icon({ name, size = 18, ...props }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...props };
  const paths = {
    upload: <><path d="M12 15V4m0 0L8 8m4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></>,
    download: <><path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M5 17v3h14v-3"/></>,
    share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4m-7.5 7 7.5 4.4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
}

function App() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('qr-theme') || 'dark'; }
    catch { return 'dark'; }
  });
  const [colorDraft, setColorDraft] = useState(DEFAULT_OPTIONS.foreground);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('qr-theme', theme); } catch { /* Storage is optional. */ }
  }, [theme]);
  const [text, setText] = useState('');
  const [foreground, setForeground] = useState(DEFAULT_OPTIONS.foreground);
  const [logo, setLogo] = useState(null);
  const [logoName, setLogoName] = useState('');
  const [logoError, setLogoError] = useState('');
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
  const nativeSharing = useMemo(() => canShareQR(result), [result]);
  useEffect(() => setColorDraft(foreground.toUpperCase()), [foreground]);
  const updateColor = value => {
    const hex = value.startsWith('#') ? value : `#${value}`;
    setColorDraft(value);
    if (/^#[0-9a-f]{6}$/i.test(hex)) selectColor(hex);
  };

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

  const selectColor = value => {
    const next = value.toLowerCase();
    if (next === foreground) return;
    invalidate();
    setForeground(next);
  };

  const acceptFile = async (file) => {
    if (!file) return;
    const uploadTicket = ++uploadGeneration.current;
    setLogoError('');
    const error = validateLogo(file);
    if (error) { setLogoError(error); setUploading(false); return; }
    invalidate();
    setUploading(true);
    try {
      const decoded = await loadLogo(file);
      if (uploadGeneration.current !== uploadTicket) return;
      setLogo(decoded);
      setLogoName(file.name || 'Your logo');
      const primary = decoded.colors.find(color => contrastRatio(color, '#ffffff') >= 4.5)
        || decoded.colors.find(color => contrastRatio(color, '#ffffff') > 1.5);
      setForeground(primary || DEFAULT_OPTIONS.foreground);
      setUploading(false);
    } catch (error) {
      if (uploadGeneration.current !== uploadTicket) return;
      setUploading(false);
      setLogoError(error?.message || 'This image couldn’t be opened. Try another PNG or JPG.');
    }
  };

  const removeLogo = () => {
    uploadGeneration.current += 1;
    invalidate();
    setUploading(false);
    setLogo(null);
    setLogoName('');
    setLogoError('');
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
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#main" aria-label="Custom QR code generator">
          <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><rect className="mark-tile" x="1" y="1" width="38" height="38" rx="10"/><path d="M9 9h8v8H9zM23 9h8v8h-8zM9 23h8v8H9z" fill="none" stroke="var(--surface)" strokeWidth="2.5"/><path d="M23 23h4v4h4v4h-8zM29 21h3v3h-3z" fill="var(--surface)"/></svg>
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
            <textarea id="qr-content" value={text} onChange={event => handleText(event.target.value)} placeholder="https://example.com" spellCheck={false} rows={3} maxLength={10000} aria-invalid={text.length > 0 && !validation.valid} aria-describedby={text.length > 0 && !validation.valid ? 'content-error' : undefined}/>
            {text.length > 0 && !validation.valid && <p className="inline-error" id="content-error" role="alert">{validation.error}</p>}
          </div>
          <div className="logo-control">
            <span className="field-label">Logo <span className="optional">Optional</span></span>
            {!logo ? <button type="button" className={`dropzone ${dragging ? 'dragging' : ''}`} disabled={uploading} onClick={() => fileInput.current?.click()} onDragOver={event => {event.preventDefault();setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={event => {event.preventDefault();setDragging(false);acceptFile(event.dataTransfer.files?.[0]);}} aria-describedby={logoError ? 'logo-error' : undefined}><span className="upload-icon"><Icon name="upload" size={19}/></span><span className="upload-copy"><strong>{uploading ? 'Preparing logo…' : 'Add your logo'}</strong><small>PNG or JPG</small></span><span className="upload-plus" aria-hidden="true">+</span></button> : <div className="logo-loaded"><span className="logo-thumb"><img src={logo.dataUrl} alt="Uploaded logo"/></span><span className="logo-file">{logoName}</span><button type="button" className="replace-button" onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? 'Loading…' : 'Replace'}</button><button type="button" className="icon-button" aria-label="Remove logo" onClick={removeLogo}><Icon name="close" size={16}/></button></div>}
            <input ref={fileInput} className="visually-hidden" type="file" accept="image/png,image/x-png,image/jpeg,.png,.jpg,.jpeg" onChange={event => {const file = event.target.files?.[0];event.target.value = '';acceptFile(file);}} aria-label="Choose logo file"/>
            {logoError && <p className="inline-error" id="logo-error" role="alert">{logoError}</p>}
          </div>
          <div className="color-control">
            <label className="field-label" htmlFor="hex-color">Color</label>
            <div className="color-options">
              <div className="selected-color">
                <input className="color-swatch" type="color" aria-label="Choose QR color" title="Open color picker" value={foreground} onChange={event => selectColor(event.target.value)}/>
                <input id="hex-color" className="hex-field" aria-label="Hex color" title="Click to edit hex color" value={colorDraft} onChange={event => updateColor(event.target.value)} onBlur={() => setColorDraft(foreground.toUpperCase())} onFocus={event => event.target.select()} onKeyDown={event => {if(event.key === 'Enter')event.currentTarget.blur();if(event.key === 'Escape'){setColorDraft(foreground.toUpperCase());event.currentTarget.blur();}}} spellCheck={false} maxLength={7}/>
              </div>
              {palette.length > 1 && <div className="brand-colors" aria-label="Logo colors">{palette.map(color => <button key={color} type="button" className={`palette-swatch ${foreground.toLowerCase() === color ? 'chosen' : ''}`} style={{'--swatch':color}} aria-label={`Use logo color ${color}`} aria-pressed={foreground.toLowerCase() === color} onClick={() => selectColor(color)}/>)}</div>}
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
            <button type="button" className="button button-secondary" disabled={!readyResult} title={nativeSharing ? 'Share PNG with another app' : 'Share this QR code. This browser will copy the PNG so you can paste it into another app.'} onClick={() => doAction(nativeSharing ? shareQR : copyQR, nativeSharing ? 'QR code shared.' : 'PNG copied. Paste it into your message.')}><Icon name="share" size={16}/>Share</button>
          </div>
          <p className="status-message" role="status" aria-live="polite">{message}</p>
        </section>
      </main>
    </div>
  );
}

export default App;
