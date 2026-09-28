const fs = require('fs');

let css = fs.readFileSync('src/App.css', 'utf8');

// Fix scrolling on the analytics and directory overlay
if (!css.includes('overflow-y: auto;') && css.includes('.directory-overlay {\\r\\n  position: fixed;')) {
  // Try exact replacement if CRLF
  css = css.replace(
    /\.directory-overlay\s*{[^}]+}/,
    `.directory-overlay {
  position: fixed;
  top: 64px;
  left: 0;
  width: 100%;
  height: calc(100vh - 64px);
  background: var(--bg-dark);
  z-index: 20;
  display: flex;
  flex-direction: column;
  padding: 32px;
  overflow-y: auto;
}`
  );
} else {
  // Fallback regex
  css = css.replace(
    /\.directory-overlay\s*{[^}]+}/,
    `.directory-overlay {
  position: fixed;
  top: 64px;
  left: 0;
  width: 100%;
  height: calc(100vh - 64px);
  background: var(--bg-dark);
  z-index: 20;
  display: flex;
  flex-direction: column;
  padding: 32px;
  overflow-y: auto;
}`
  );
}
fs.writeFileSync('src/App.css', css);

let jsx = fs.readFileSync('src/App.jsx', 'utf8');
// Inject the Caller ID log and Busiest Day analytic at the end of the analytics-card list
const callerIdSnippet = `
            <div className="analytics-card" style={{width: '100%', maxWidth: '600px'}}>
              <h3>Busiest Day of the Week</h3>
              <div className="stat-number">
                {(() => {
                  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                  const counts = [0,0,0,0,0,0,0];
                  messages.filter(m => m.direction === 'inbound').forEach(m => {
                    counts[new Date(m.created_at).getDay()]++;
                  });
                  const maxDay = counts.indexOf(Math.max(...counts));
                  return Math.max(...counts) > 0 ? days[maxDay] : 'N/A';
                })()}
              </div>
            </div>

            <div className="analytics-card" style={{width: '100%', maxWidth: '100%'}}>
              <h3>Recent Inbound Log (Caller ID / Messages)</h3>
              <p style={{fontSize: 12, opacity: 0.7, marginBottom: 12}}>A chronological log of everyone who has contacted the Haconet line.</p>
              <div style={{maxHeight: '400px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: 8}}>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
                  <thead>
                    <tr style={{background: 'rgba(255,255,255,0.05)', textAlign: 'left'}}>
                      <th style={{padding: '12px'}}>Date</th>
                      <th style={{padding: '12px'}}>Phone / Caller</th>
                      <th style={{padding: '12px'}}>Department</th>
                      <th style={{padding: '12px'}}>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.filter(m => m.direction === 'inbound').sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50).map(m => {
                      const contact = contacts[m.sender_number];
                      const name = contact?.first_name ? \`\${contact.first_name} \${contact.last_name || ''}\` : m.sender_number;
                      return (
                        <tr key={m.id} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                          <td style={{padding: '12px', whiteSpace: 'nowrap'}}>{new Date(m.created_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</td>
                          <td style={{padding: '12px', fontWeight: 'bold'}}>{name}</td>
                          <td style={{padding: '12px'}}><span className="mini-badge">{contact?.department || 'General'}</span></td>
                          <td style={{padding: '12px', opacity: 0.8, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{m.body || 'Media / Voicemail attached'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
`;

// Insert it before the closing div of the analytics cards wrapper
jsx = jsx.replace(
  /<\/div>\s*<\/div>\s*\}\)\s*\{\/\* BROADCAST MODAL/,
  `</div>\n${callerIdSnippet}\n</div>\n      }\n\n      {/* BROADCAST MODAL`
);

fs.writeFileSync('src/App.jsx', jsx);
console.log("Analytics Fixed");
