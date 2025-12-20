// Console helper script for collecting betting slip DOM information
// Usage: copy/paste this into the DevTools Console on the exchange betting slip page and run.

(function collectBetslipInfo() {
  function getClosestHtml(el, levels) {
    let html = '';
    let node = el;
    for (let i = 0; i < levels && node; i++) {
      html += `${node.outerHTML}\n`;
      node = node.parentElement;
    }
    return html;
  }

  function sanitizeString(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  const allInputs = Array.from(document.querySelectorAll('input[type="number"], input[type="text"], input.betslip-size-input'));
  const inputs = allInputs.filter(i => i.offsetHeight > 0 && i.offsetWidth > 0);

  const containers = Array.from(document.querySelectorAll('[class*="slip"], [class*="bet"], [class*="order"], [class*="panel"], .betslip-container'))
    .filter(c => c.offsetHeight > 50);

  const dataAttrs = Array.from(document.querySelectorAll('[data-test], [data-testid], [data-test-id]'))
    .filter(a => a.offsetHeight > 0)
    .map(a => ({ dataset: { ...a.dataset }, node: a.tagName, className: a.className }));

  const results = {
    url: location.href,
    timestamp: new Date().toISOString(),
    inputs: inputs.map((i) => ({
      type: i.type || '',
      className: i.className || '',
      placeholder: i.placeholder || '',
      name: i.name || '',
      id: i.id || '',
      value: i.value || '',
      parentClasses: i.parentElement?.className || '',
      html: getClosestHtml(i, 3)
    })),
    containers: containers.map(c => ({ className: c.className, html: c.outerHTML })),
    dataAttributes: dataAttrs,
    userAgent: navigator.userAgent
  };

  try {
    const json = JSON.stringify(results, null, 2);
    // Copy to clipboard if allowed
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(() => {
        console.log('✅ Betslip info copied to clipboard as JSON:');
        console.log(results);
      }).catch((err) => {
        console.log('⚠️ Could not copy to clipboard, showing JSON below:');
        console.log(json);
      });
    } else {
      console.log('⚠️ Clipboard API not available. Copy the JSON below:');
      console.log(json);
    }
  } catch (e) {
    console.error('Error collecting bets lip info:', e);
  }
})();
