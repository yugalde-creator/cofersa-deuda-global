import { getServerSession } from 'next-auth/next';
import authOptions from './api/auth/[...nextauth]';
import Head from 'next/head';

export default function AppPage() {
  const css = `
:root{
  color-scheme: light;
  --navy-900:#0b1220; --navy-800:#111827; --navy-700:#1b2536;
  --accent:#2563eb; --accent-dark:#1d4ed8; --accent-light:#dbeafe;
  --bg:#eef1f6; --card:#ffffff; --border:#e2e8f0; --border-2:#eef0f3;
  --text:#1e293b; --text-muted:#64748b; --text-faint:#94a3b8;
  --green:#15803d; --green-bg:#dcfce7;
  --amber:#a16207; --amber-bg:#fef3c7;
  --red:#b91c1c; --red-bg:#fee2e2;
  --blue:#1d4ed8; --blue-bg:#dbeafe;
}
*{box-sizing:border-box;}
html,body{height:100%;margin:0;}
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-size:13px; color:var(--text); background:var(--bg);
  -webkit-font-smoothing:antialiased;
}
#app{display:flex; height:100vh; overflow:hidden;}
.icon{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;}
.icon-lg{width:20px;height:20px;}
.sidebar{width:216px; background:var(--navy-900); color:#94a3b8; flex-shrink:0; display:flex; flex-direction:column; transition:width .18s ease; overflow:hidden;}
.sidebar.collapsed{width:60px;}
.brand{height:56px; display:flex; align-items:center; gap:10px; padding:0 16px; border-bottom:1px solid rgba(255,255,255,.08); flex-shrink:0;}
.brand-mark{width:26px;height:26px;border-radius:6px;background:linear-gradient(135deg,#2563eb,#1e40af);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;flex-shrink:0;}
.brand-name{color:#fff;font-weight:700;font-size:13.5px;white-space:nowrap;}
.brand-sub{font-size:10px;color:#64748b;white-space:nowrap;}
.sidebar nav{flex:1; padding:10px 8px; overflow-y:auto;}
.nav-group-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#475569;padding:12px 12px 4px;white-space:nowrap;font-weight:700;}
.nav-item{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:6px;cursor:pointer;color:#94a3b8;font-weight:500;margin-bottom:1px;white-space:nowrap;}
.nav-item:hover{background:rgba(255,255,255,.06);color:#e2e8f0;}
.nav-item.active{background:var(--accent);color:#fff;}
.sidebar.collapsed .nav-label,.sidebar.collapsed .brand-name,.sidebar.collapsed .brand-sub{display:none;}
.sidebar-footer{padding:10px;border-top:1px solid rgba(255,255,255,.08);}
.collapse-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:8px;border-radius:6px;background:rgba(255,255,255,.04);color:#94a3b8;cursor:pointer;border:none;font-size:12px;}
.collapse-btn:hover{background:rgba(255,255,255,.08);color:#fff;}
.main{flex:1;display:flex;flex-direction:column;min-width:0;}
.topbar{height:56px;background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 18px;flex-shrink:0;position:relative;z-index:30;}
.topbar-left{display:flex;align-items:center;gap:12px;color:var(--text-muted);font-size:13px;}
.topbar-left b{color:var(--text);font-weight:600;}
.topbar-right{display:flex;align-items:center;gap:10px;}
.content{flex:1;overflow-y:auto;padding:20px 22px;}
.icon-btn{position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:7px;border:1px solid var(--border);background:#fff;color:var(--text-muted);cursor:pointer;}
.icon-btn:hover{background:#f8fafc;color:var(--text);}
.badge-dot{position:absolute;top:5px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--red);border:1.5px solid #fff;}
.role-pill{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em;}
.role-pill.admin{background:var(--blue-bg);color:var(--blue);}
.role-pill.consulta{background:#f1f5f9;color:var(--text-muted);}
.user-chip{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;border-radius:20px;border:1px solid var(--border);cursor:pointer;background:#fff;}
.avatar{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#334155,#0f172a);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;}
.dropdown{position:absolute;top:48px;right:0;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.14);width:300px;z-index:40;display:none;overflow:hidden;}
.dropdown.open{display:block;}
.dropdown-header{padding:12px 14px;border-bottom:1px solid var(--border-2);font-weight:700;font-size:12.5px;color:var(--text-muted);}
.notif-item{padding:11px 14px;border-bottom:1px solid var(--border-2);display:flex;gap:10px;}
.notif-item:last-child{border-bottom:none;}
.notif-dot{width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;}
.notif-title{font-size:12.5px;font-weight:600;color:var(--text);}
.notif-sub{font-size:11.5px;color:var(--text-muted);margin-top:2px;}
.user-menu-item{padding:10px 14px;font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:10px;color:var(--text);}
.user-menu-item:hover{background:#f8fafc;}
.section-title{font-size:15px;font-weight:700;color:var(--text);margin:0 0 14px;}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px;}
.kpi-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:15px 16px;}
.kpi-top{display:flex;justify-content:space-between;align-items:flex-start;}
.kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);font-weight:700;}
.kpi-icon{width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.kpi-value{font-size:23px;font-weight:800;margin-top:8px;color:var(--text);letter-spacing:-.01em;}
.kpi-delta{font-size:11.5px;margin-top:6px;color:var(--text-muted);font-weight:600;}
.panel-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;}
.panel-grid .table-card h3{margin:0;font-size:13px;font-weight:700;}
.fx-note{font-size:11px;color:var(--text-muted);font-weight:600;white-space:nowrap;}
.panel-header-dark{background:var(--navy-900);color:#fff;padding:10px 14px;display:flex;align-items:center;gap:9px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;flex-shrink:0;}
.panel-header-dark .icon{stroke:#fff;}
tbody tr.total-row{cursor:default;}
tbody tr.total-row td{background:var(--navy-900);color:#fff;font-weight:800;border-bottom:none;}
tbody tr.total-row:hover td{background:var(--navy-900);}
.kv-table td{padding:9px 14px;}
.kv-table tr:nth-child(even){background:#fafbfc;}
.kv-table .k{color:var(--text-muted);font-weight:600;}
.kv-table .v{font-weight:800;text-align:right;color:var(--text);}
.tab-bar{display:flex;gap:4px;padding:10px 12px 0;background:#fbfcfd;border-bottom:1px solid var(--border);}
.tab-btn{padding:8px 14px;border-radius:6px 6px 0 0;font-size:12.5px;font-weight:700;color:var(--text-muted);cursor:pointer;border:1px solid transparent;}
.tab-btn:hover{color:var(--text);}
.tab-btn.active{background:#fff;color:var(--accent);border:1px solid var(--border);border-bottom-color:#fff;margin-bottom:-1px;}
.import-panel{padding:14px;}
.import-hint{font-size:11.5px;color:var(--text-muted);margin-bottom:8px;line-height:1.5;}
.import-hint code{background:#f1f5f9;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:11px;}
.csv-textarea{width:100%;border:1px solid var(--border);border-radius:6px;padding:9px 11px;font-size:11.5px;font-family;"SFMono-Regular",Consolas,monospace;resize:vertical;color:var(--text);}
.import-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;}
.cal-grid-header{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);padding:8px 0;border-bottom:1px solid var(--border);background:#fbfcfd;}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--border);}
.cal-cell{background:#fff;min-height:64px;padding:6px;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;gap:4px;}
.cal-cell.empty{background:#f8fafc;cursor:default;}
.cal-cell:not(.empty):hover{background:var(--accent-light);}
.cal-cell.today .cal-daynum{color:var(--accent);}
.cal-cell.selected{background:var(--accent-light);outline:2px solid var(--accent);outline-offset:-2px;}
.cal-daynum{font-size:12px;font-weight:700;color:var(--text-muted);}
.table-card{background:var(--card);border:1px solid var(--border);border-radius:10px;display:flex;flex-direction:column;overflow:hidden;}
.table-toolbar{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border);flex-wrap:wrap;background:#fbfcfd;}
.tb-search{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:6px 10px;min-width:210px;color:var(--text-muted);}
.tb-search input{border:none;outline:none;font-size:12.5px;width:100%;color:var(--text);background:transparent;}
.tb-select{border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:12.5px;background:#fff;color:var(--text);}
.spacer{flex:1;}
.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:#fff;color:var(--text);white-space:nowrap;}
.btn:hover{background:#f8fafc;}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#fff;}
.btn-primary:hover{background:var(--accent-dark);}
.btn:disabled,.btn[disabled]{opacity:.45;cursor:not-allowed;}
.btn:disabled:hover{background:#fff;}
.btn-primary:disabled:hover{background:var(--accent);}
.table-scroll{overflow:auto;max-height:calc(100vh - 300px);}
table{width:100%;border-collapse:collapse;font-size:12.5px;}
thead th{position:sticky;top:0;background:#f8fafc;text-align:left;padding:9px 12px;font-weight:700;color:var(--text-muted);border-bottom:1px solid var(--border);white-space:nowrap;z-index:5;font-size:11.5px;text-transform:uppercase;letter-spacing:.03em;}
tbody td{padding:9px 12px;border-bottom:1px solid var(--border-2);white-space:nowrap;color:var(--text);}
tbody tr{cursor:pointer;}
tbody tr:nth-child(even){background:#fafbfc;}
tbody tr:hover{background:var(--accent-light);}
.mono{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";}
.text-muted{color:var(--text-muted);}
.text-right{text-align:right;}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;}
.badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;}
.badge-green{background:var(--green-bg);color:var(--green);}
.badge-amber{background:var(--amber-bg);color:var(--amber);}
.badge-red{background:var(--red-bg);color:var(--red);}
.badge-blue{background:var(--blue-bg);color:var(--blue);}
.badge-gray{background:#f1f5f9;color:var(--text-muted);}
.module-grid{display:grid;grid-template-columns:1fr;gap:16px;}
.module-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:100;opacity:0;pointer-events:none;transition:opacity .15s ease;}
.modal-backdrop.open{opacity:1;pointer-events:auto;}
.modal{background:#fff;border-radius:12px;width:600px;max-width:92vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.32);transform:scale(.96) translateY(6px);transition:transform .16s ease;}
.modal-backdrop.open .modal{transform:scale(1) translateY(0);}
.modal-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;}
.modal-header h2{margin:0;font-size:15px;font-weight:700;}
.modal-header .sub{font-size:11.5px;color:var(--text-muted);margin-top:2px;font-weight:500;}
.modal-close{width:28px;height:28px;border-radius:6px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;}
.modal-close:hover{background:#f1f5f9;color:var(--text);}
.modal-body{padding:18px 20px;overflow-y:auto;}
.modal-footer{padding:13px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;background:#fbfcfd;}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.form-field{display:flex;flex-direction:column;gap:5px;}
.form-field.full{grid-column:1/-1;}
.form-field label{font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.02em;}
.form-field input,.form-field select{border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:12.5px;color:var(--text);font-family:inherit;}
.form-field input:focus,.form-field select:focus{outline:2px solid var(--accent-light);border-color:var(--accent);}
.readonly-notice{background:var(--amber-bg);color:var(--amber);border-radius:8px;padding:10px 12px;font-size:12px;font-weight:600;display:flex;gap:8px;align-items:center;margin-bottom:14px;}
.detail-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border-2);font-size:12.5px;}
.detail-row:last-child{border-bottom:none;}
.detail-row .k{color:var(--text-muted);font-weight:600;}
.detail-row .v{font-weight:700;color:var(--text);}
.toast-wrap{position:fixed;bottom:20px;right:20px;z-index:200;display:flex;flex-direction:column;gap:8px;}
.toast{background:var(--navy-900);color:#fff;padding:11px 16px;border-radius:8px;font-size:12.5px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.3);display:flex;align-items:center;gap:8px;animation:slideIn .2s ease;}
.toast.error{background:#7f1d1d;}
@keyframes slideIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.empty-state{padding:40px 20px;text-align:center;color:var(--text-muted);font-size:12.5px;}
.progress-bar-track{width:60px;height:5px;background:#e2e8f0;border-radius:99px;overflow:hidden;display:inline-block;vertical-align:middle;margin-right:6px;}
.progress-bar-fill{height:100%;background:var(--accent);}
.boot-screen{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--text-muted);font-size:13px;}
.boot-spinner{width:34px;height:34px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--accent);animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.denied-card{max-width:420px;text-align:center;background:#fff;border:1px solid var(--border);border-radius:12px;padding:28px 26px;box-shadow:0 12px 32px rgba(15,23,42,.08);}
.denied-card h2{margin:0 0 8px;font-size:16px;color:var(--text);}
.denied-card p{margin:0;font-size:12.5px;line-height:1.6;}
`;

  return (
    <>
      <Head>
        <title>Deuda Global — Cofersa</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta charSet="UTF-8" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div id="app">
        <div className="boot-screen" id="bootScreen">
          <div className="boot-spinner"></div>
          <div>Cargando Deuda Global...</div>
        </div>
      </div>
      <div id="modal-root"></div>
      <div className="toast-wrap" id="toastWrap"></div>
      <script src="/app.js" defer></script>
    </>
  );
}

export async function getServerSideProps(context) {
  const authOptions = (await import('./api/auth/[...nextauth]')).default;
  const { getServerSession } = await import('next-auth/next');
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: { destination: '/login', permanent: false },
    };
  }

  return { props: {} };
}
