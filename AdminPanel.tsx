import { useEffect, useState } from 'react'
import { ArrowLeft, Ban, CheckCircle2, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react'
import { API_BASE } from './api'
import './admin.css'

type Customer = {id:string;email:string;display_name:string;role:string;active:boolean;created_at:string;last_activity?:string;license?:{plan:string;expires_at:string;status:string}|null;subscription?:{plan?:string;status?:string;currentPeriodEnd?:string}|null}
type Overview = {total_users:number;active_users:number;new_users:number;pro_users:number;free_users:number;active_subscriptions:number;expired_subscriptions:number;customers:Customer[];billing_live:boolean}

function message(payload:unknown):string { return payload && typeof payload === 'object' && 'detail' in payload && typeof (payload as {detail:unknown}).detail === 'string' ? (payload as {detail:string}).detail : 'İşlem tamamlanamadı.' }

export default function AdminPanel({token,onBack}:{token:string;onBack:()=>void}) {
  const [overview,setOverview] = useState<Overview|null>(null)
  const [query,setQuery] = useState('')
  const [plan,setPlan] = useState('ALL')
  const [page,setPage] = useState(1)
  const [selected,setSelected] = useState<Customer|null>(null)
  const [notice,setNotice] = useState('')
  const [busy,setBusy] = useState(false)
  const pageSize = 8
  const request = async <T,>(path:string, options:RequestInit = {}):Promise<T> => {
    const headers = new Headers(options.headers); headers.set('Authorization',`Bearer ${token}`)
    if (options.body) headers.set('Content-Type','application/json')
    const response = await fetch(`${API_BASE}/v22${path}`,{...options,headers})
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(message(payload))
    return payload as T
  }
  const refresh = async () => { setBusy(true); try { setOverview(await request<Overview>('/admin/overview')); setNotice('') } catch (error) { setNotice(error instanceof Error ? error.message : 'Admin verisi alınamadı.') } finally { setBusy(false) } }
  useEffect(() => { void refresh() }, [])
  const filtered = (overview?.customers || []).filter(user => {
    const text = `${user.display_name} ${user.email}`.toLowerCase()
    const userPlan = String(user.subscription?.plan || user.license?.plan || 'FREE').toUpperCase()
    return text.includes(query.toLowerCase()) && (plan === 'ALL' || userPlan === plan)
  })
  const rows = filtered.slice((page - 1) * pageSize,page * pageSize)
  const mutate = async (user:Customer, action:'status'|'plan'|'role') => {
    if (user.role === 'OWNER' && action !== 'role') return
    if (action === 'status') {
      const active = !user.active
      if (!window.confirm(`${user.display_name} hesabı ${active ? 'etkinleştirilsin' : 'askıya alınsın'} mi?`)) return
      await request(`/customers/${user.id}/status`,{method:'POST',body:JSON.stringify({active,reason:'Admin Dashboard'})})
    } else if (action === 'plan') {
      const nextPlan = (window.prompt('Plan: FREE, PRO veya STARTER','PRO') || '').toUpperCase()
      if (!['FREE','PRO','STARTER','ELITE'].includes(nextPlan) || !window.confirm(`${user.display_name} için ${nextPlan} planı 30 gün etkinleştirilsin mi?`)) return
      await request('/subscriptions/activate-demo',{method:'POST',body:JSON.stringify({user_id:user.id,plan:nextPlan === 'FREE' ? 'TRIAL' : nextPlan,days:30})})
    } else {
      const nextRole = user.role === 'OWNER' ? 'CUSTOMER' : 'OWNER'
      if (!window.confirm(`${user.display_name} rolü ${nextRole} olarak değiştirilsin mi?`)) return
      await request(`/admin/users/${user.id}/role`,{method:'PATCH',body:JSON.stringify({role:nextRole})})
    }
    await refresh(); setSelected(null); setNotice('Admin işlemi tamamlandı.')
  }
  return <main className="adminPage">
    <header className="adminHeader"><div><span className="adminEyebrow">PROTREBOT / ADMIN CONTROL</span><h1>Admin Dashboard</h1><p>Kullanıcı, erişim ve üyelik durumunu backend doğrulamasıyla yönetin.</p></div><div className="adminHeaderActions"><button onClick={onBack}><ArrowLeft/> Dashboard</button><button onClick={() => void refresh()} disabled={busy}><RefreshCw className={busy ? 'spin' : ''}/> Yenile</button></div></header>
    {notice && <p className="adminNotice">{notice}</p>}
    <section className="adminMetrics">{[['TOTAL USERS',overview?.total_users ?? 0],['ACTIVE USERS',overview?.active_users ?? 0],['NEW USERS',overview?.new_users ?? 0],['PRO USERS',overview?.pro_users ?? 0],['FREE USERS',overview?.free_users ?? 0],['ACTIVE SUBSCRIPTIONS',overview?.active_subscriptions ?? 0],['EXPIRED',overview?.expired_subscriptions ?? 0],['SYSTEM STATUS',overview ? 'ONLINE' : 'LOADING']].map(([label,value]) => <article key={String(label)}><small>{label}</small><b>{value}</b></article>)}</section>
    <section className="adminUsers"><header className="adminSectionHeader"><div><span>USER MANAGEMENT</span><h2>Accounts</h2></div><div className="adminFilters"><label><Search/><input value={query} onChange={event => {setQuery(event.target.value);setPage(1)}} placeholder="Search users"/></label><select value={plan} onChange={event => {setPlan(event.target.value);setPage(1)}}><option value="ALL">All plans</option><option value="FREE">FREE</option><option value="PRO">PRO</option><option value="STARTER">STARTER</option><option value="ELITE">ELITE</option></select></div></header><div className="adminTable"><div className="adminTableHead"><span>User</span><span>Role</span><span>Plan</span><span>Status</span><span>Created</span><span>Actions</span></div>{rows.map(user => <article key={user.id} className="adminRow"><button className="adminUser" onClick={() => setSelected(user)}><UserRound/><span><b>{user.display_name}</b><small>{user.email}</small></span></button><span className="adminBadge">{user.role === 'OWNER' ? 'ADMIN' : 'USER'}</span><span className="adminBadge plan">{String(user.subscription?.plan || user.license?.plan || 'FREE').toUpperCase()}</span><span className={user.active ? 'statusActive' : 'statusInactive'}>{user.active ? 'ACTIVE' : 'INACTIVE'}</span><time>{user.created_at ? new Date(user.created_at).toLocaleDateString('tr-TR') : '—'}</time><div className="adminActions"><button onClick={() => void mutate(user,'plan')}>Plan</button><button onClick={() => void mutate(user,'status')}><>{user.active ? <Ban/> : <CheckCircle2/>}</></button></div></article>)}{!rows.length && <div className="adminEmpty"><UserRound/><b>No users found</b><span>Try another search or filter.</span></div>}</div><footer className="adminPagination"><span>{filtered.length} users</span><div><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><b>{page}</b><button disabled={page * pageSize >= filtered.length} onClick={() => setPage(value => value + 1)}>Next</button></div></footer></section>
    {selected && <aside className="adminDrawer"><header><div><span>USER DETAIL</span><h2>{selected.display_name}</h2></div><button onClick={() => setSelected(null)}>×</button></header><dl><dt>Email</dt><dd>{selected.email}</dd><dt>User ID</dt><dd>{selected.id}</dd><dt>Role</dt><dd>{selected.role === 'OWNER' ? 'ADMIN' : 'USER'}</dd><dt>Plan</dt><dd>{String(selected.subscription?.plan || selected.license?.plan || 'FREE').toUpperCase()}</dd><dt>Account status</dt><dd>{selected.active ? 'Active' : 'Inactive'}</dd><dt>Last activity</dt><dd>{selected.last_activity ? new Date(selected.last_activity).toLocaleString('tr-TR') : '—'}</dd></dl><div className="adminDrawerActions"><button onClick={() => void mutate(selected,'plan')}>Change subscription</button><button onClick={() => void mutate(selected,'status')}>{selected.active ? 'Deactivate account' : 'Activate account'}</button><button onClick={() => void mutate(selected,'role')}><ShieldCheck/> Change role</button></div></aside>}
  </main>
}
