const fs = require('fs');

let css = fs.readFileSync('src/App.css', 'utf8');

// Fix body scrolling by locking dashboard layout to 100vh
css = css.replace(
  /height:\s*100%;\s*width:\s*100%;\s*flex:\s*1;/g, 
  'height: 100vh;\n  width: 100%;\n  overflow: hidden;'
);

// Fix overlapping tags
css = css.replace(
  /\.contact-number\s*{[^}]+}/g, 
  `.contact-number {
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}`
);

// Fix text overlapping timestamp
css = css.replace(
  /\.contact-preview\s*{[^}]+}/g, 
  `.contact-preview {
  font-size: 13px;
  color: var(--text-muted);
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}`
);

fs.writeFileSync('src/App.css', css);

let jsx = fs.readFileSync('src/App.jsx', 'utf8');
// Fix sidebar contact preview JSX structure
jsx = jsx.replace(
  /<div className="contact-preview" style=\{\{display: 'flex', justifyContent: 'space-between', alignItems: 'center'\}\}>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
  `<div className="contact-preview">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      {contacts[number]?.first_name && <span style={{fontSize: '11px', opacity: 0.5}}>{number}</span>}
                      {contacts[number]?.last_message_at && (
                        <span style={{fontSize: '11px', opacity: 0.5}}>
                          {new Date(contacts[number].last_message_at).toLocaleString([], {month: 'short', day: 'numeric'})}
                        </span>
                      )}
                    </div>
                    <div style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontSize: '13px'}}>
                      {messages.filter(m => m.sender_number === number).slice(-1)[0]?.body || 'Media attached'}
                    </div>
                  </div>
                </div>
              </div>`
);

fs.writeFileSync('src/App.jsx', jsx);
console.log("UI Fixed");
