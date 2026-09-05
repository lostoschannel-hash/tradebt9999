import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, KeyRound, LogOut, MailCheck, ShieldCheck, UserRound } from 'lucide-react'
import { API_BASE, clearUserSessionToken, saveUserSessionToken, userSessionToken } from './api'
import './auth.css'

type User = { id:string; email:string; display_name:string; role:string; active:boolean; email_verified?:boolean }
type Session = { user:User }
type Mode = 'login'|'register'|'forgot'|'reset'|'verify'

function detail(payload:unknown):string {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const value = (payload as {detail:unknown}).detail
    if (typeof value === 'string') return value
  }
  return 'İşlem tamamlanamadı. Bilgilerinizi kontrol edip tekrar deneyin.'
}

async function request<T>(path:string, options:RequestInit = {}):Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type','application/json')
  const response = await fetch(`${API_BASE}/v22${path}`, {...options, headers})
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(detail(payload))
  return payload as T
}

function strength(password:string):{label:string;score:number} {
  const score = [password.length >= 10, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length
  return {score, label:score < 2 ? 'Zayıf' : score < 4 ? 'Orta' : 'Güçlü'}
}

export default function AuthGate({children}:{children:ReactNode}) {
  const [token,setToken] = useState(userSessionToken())
  const [session,setSession] = useState<Session|null>(null)
  const [mode,setMode] = useState<Mode>(() => window.location.pathname === '/register' ? 'register' : window.location.pathname === '/forgot-password' ? 'forgot' : window.location.pathname === '/reset-password' ? 'reset' : 'login')
  const [busy,setBusy] = useState(true)
  const [message,setMessage] = useState('Oturum doğrulanıyor…')
  const [showPassword,setShowPassword] = useState(false)
  const [remember,setRemember] = useState(true)
  const [login,setLogin] = useState({email:'',password:''})
  const [register,setRegister] = useState({display_name:'',email:'',password:'',confirm_password:'',terms_accepted:false})
  const [email,setEmail] = useState('')
  const [resetToken,setResetToken] = useState(new URLSearchParams(window.location.search).get('token') || '')
  const [resetPassword,setResetPassword] = useState({password:'',confirm_password:''})

  const loadSession = async (value:string) => {
    if (!value) { setBusy(false); return }
    try {
      const current = await request<Session>('/session',{headers:{Authorization:`Bearer ${value}`}})
      setSession(current); setMessage('')
    } catch {
      clearUserSessionToken(); setToken(''); setSession(null); setMessage('Oturum açmak için devam edin.')
    } finally { setBusy(false) }
  }

  useEffect(() => { void loadSession(token) }, [])

  const submit = async (event:FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (mode === 'login') {
        const result = await request<{token:string;user:User}>('/auth/login',{method:'POST',body:JSON.stringify({...login,remember})})
        if (result.user.role !== 'OWNER' && result.user.email_verified === false) {
          setEmail(result.user.email); setResetToken(''); setMode('verify'); setMessage('Önce e-posta adresinizi doğrulayın. Doğrulama kodunu e-postanızdan alın.')
        } else {
          saveUserSessionToken(result.token,remember); setToken(result.token); setSession({user:result.user})
        }
      } else if (mode === 'register') {
        const result = await request<{development_verification_token?:string;message:string}>('/auth/register',{method:'POST',body:JSON.stringify(register)})
        setEmail(register.email); setResetToken(result.development_verification_token || ''); setMode('verify'); setMessage(result.message)
      } else if (mode === 'forgot') {
        const result = await request<{development_reset_token?:string;message:string}>('/auth/forgot-password',{method:'POST',body:JSON.stringify({email})})
        if (result.development_reset_token) setResetToken(result.development_reset_token)
        setMessage(result.message); if (result.development_reset_token) setMode('reset')
      } else if (mode === 'reset') {
        await request('/auth/reset-password',{method:'POST',body:JSON.stringify({token:resetToken,...resetPassword})})
        setMessage('Parolanız güncellendi. Giriş yapabilirsiniz.'); setMode('login')
      } else {
        await request('/auth/verify-email',{method:'POST',body:JSON.stringify({token:resetToken})})
        setMessage('E-posta doğrulandı. Şimdi giriş yapabilirsiniz.'); setMode('login')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'İşlem başarısız.') }
    finally { setBusy(false) }
  }

  const logout = async () => {
    try { if (token) await request('/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`}}) } catch { /* local logout still clears the session */ }
    clearUserSessionToken(); setToken(''); setSession(null); setMode('login'); setMessage('Oturum kapatıldı.')
  }

  if (busy && !session) return <main className="authLoading"><div className="authLoader"><ShieldCheck/><b>GÜVENLİ OTURUM</b><span>Hesap durumu kontrol ediliyor…</span></div></main>
  if (!session) {
    const registrationStrength = strength(register.password)
    return <main className="authPage">
      <section className="authIntro"><span className="authEyebrow">PROTREBOT / SECURE ACCESS</span><h1>Trading operasyonunuz için sakin, kontrollü bir çalışma alanı.</h1><p>Demo, analiz ve risk araçları tek bir güvenli oturumla korunur. Gerçek Binance emri bu authentication katmanı tarafından gönderilmez.</p><div className="authProof"><span><ShieldCheck/> Backend doğrulamalı</span><span><KeyRound/> Scrypt parola koruması</span><span><MailCheck/> E-posta kontrollü</span></div></section>
      <section className="authCard">
        <div className="authCardHead"><div className="authMark"><UserRound/></div><div><span>MEMBER ACCESS</span><h2>{mode === 'login' ? 'Hesabınıza giriş yapın' : mode === 'register' ? 'Yeni hesap oluşturun' : mode === 'forgot' ? 'Parolanızı yenileyin' : mode === 'reset' ? 'Yeni parola belirleyin' : 'E-postanızı doğrulayın'}</h2></div></div>
        <form onSubmit={submit}>
          {mode === 'login' && <><label>E-posta<input type="email" required autoComplete="username" value={login.email} onChange={event => setLogin({...login,email:event.target.value})} placeholder="siz@ornek.com"/></label><label>Parola<div className="authPassword"><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={login.password} onChange={event => setLogin({...login,password:event.target.value})}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label="Parolayı göster veya gizle">{showPassword ? <EyeOff/> : <Eye/>}</button></div></label><label className="authCheck"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)}/><span>Bu cihazda oturumu hatırla</span></label></>}
          {mode === 'register' && <><label>Ad soyad<input required autoComplete="name" value={register.display_name} onChange={event => setRegister({...register,display_name:event.target.value})} placeholder="Ada Yılmaz"/></label><label>E-posta<input required type="email" autoComplete="email" value={register.email} onChange={event => setRegister({...register,email:event.target.value})} placeholder="siz@ornek.com"/></label><label>Parola<div className="authPassword"><input required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={register.password} onChange={event => setRegister({...register,password:event.target.value})}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label="Parolayı göster veya gizle">{showPassword ? <EyeOff/> : <Eye/>}</button></div><div className={`passwordMeter strength${registrationStrength.score}`}><i style={{width:`${registrationStrength.score * 25}%`}}/><span>{registrationStrength.label} · en az 10 karakter, büyük harf, sayı ve sembol kullanın</span></div></label><label>Parola tekrar<input required type="password" autoComplete="new-password" value={register.confirm_password} onChange={event => setRegister({...register,confirm_password:event.target.value})}/></label><label className="authCheck"><input type="checkbox" checked={register.terms_accepted} onChange={event => setRegister({...register,terms_accepted:event.target.checked})}/><span>Kullanım koşullarını ve gizlilik politikasını kabul ediyorum.</span></label></>}
          {mode === 'forgot' && <label>E-posta<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="siz@ornek.com"/><small>Kayıtlıysa yenileme bağlantısı hazırlanır.</small></label>}
          {mode === 'verify' && <label>Doğrulama kodu<input required value={resetToken} onChange={event => setResetToken(event.target.value)} placeholder="E-posta doğrulama kodu"/><small>{message || 'Kayıt sonrası e-postanızdaki kodu girin.'}</small></label>}
          {mode === 'reset' && <><label>Doğrulama kodu<input required value={resetToken} onChange={event => setResetToken(event.target.value)}/></label><label>Yeni parola<input required type="password" autoComplete="new-password" value={resetPassword.password} onChange={event => setResetPassword({...resetPassword,password:event.target.value})}/></label><label>Yeni parola tekrar<input required type="password" autoComplete="new-password" value={resetPassword.confirm_password} onChange={event => setResetPassword({...resetPassword,confirm_password:event.target.value})}/></label></>}
          <button className="authSubmit" disabled={busy}>{busy ? 'İŞLENİYOR…' : mode === 'login' ? 'GÜVENLİ GİRİŞ' : mode === 'register' ? 'HESAP OLUŞTUR' : mode === 'forgot' ? 'YENİLEME BAĞLANTISI GÖNDER' : mode === 'reset' ? 'PAROLAYI GÜNCELLE' : 'E-POSTAYI DOĞRULA'}<ArrowRight/></button>
        </form>
        {message && <p className="authMessage">{message}</p>}
        <div className="authLinks">{mode === 'login' && <><button onClick={() => setMode('forgot')}>Parolamı unuttum</button><button onClick={() => setMode('register')}>Yeni hesap oluştur</button></>}{mode !== 'login' && <button onClick={() => setMode('login')}>Giriş ekranına dön</button>}</div>
      </section>
    </main>
  }

  if (window.location.pathname.startsWith('/admin') && session.user.role !== 'OWNER') return <main className="authLoading"><div className="authLoader"><ShieldCheck/><b>403 · ERİŞİM YOK</b><span>Bu alan yalnızca yönetici hesaplarına açıktır.</span><button onClick={() => {history.replaceState(null,'','/dashboard'); location.reload()}}>Dashboard'a dön</button></div></main>
  return <><div className="authSessionBar"><span><ShieldCheck/> {session.user.display_name} <b>{session.user.role === 'OWNER' ? 'ADMIN' : 'MEMBER'}</b></span><button onClick={() => void logout()}><LogOut/> Çıkış</button></div>{children}</>
}
