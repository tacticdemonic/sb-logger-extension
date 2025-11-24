/*
Create a bookmarklet that collects betting slip DOM info and opens a new GitHub issue prefilled
with the Add Exchange Support template.

How to create the bookmarklet:
1. Create a new bookmark in your browser.
2. For the bookmark URL, paste the output of this script (run it below or copy the string printed).

If you want to use directly as a bookmarklet, the final line `console.log(bookmarklet)` prints a single-line `javascript:(function(){...})();` you can copy.
*/

(function generateBookmarklet() {
  // The actual bookmarklet content (minified for brevity) - you can paste this into the bookmark URL
  const bookmarklet = `javascript:(function(){
    function getClosestHtml(el, levels){
      var html=''; var node=el; for(var i=0;i<levels&&node;i++){ html+=node.outerHTML+'\n'; node=node.parentElement } return html }
    function sanitize(s){ return (s||'').replace(/\s+/g,' ').trim() }
    var inputs=Array.from(document.querySelectorAll('input[type="number"], input[type="text"], input.betslip-size-input, input[bf-number-restrict]')).filter(i=>i.offsetHeight>0&&i.offsetWidth>0).map(i=>({ type:i.type||'', className:i.className||'', placeholder:i.placeholder||'', name:i.name||'', id:i.id||'', value:i.value||'', parentClasses:i.parentElement?i.parentElement.className:'', html: getClosestHtml(i,3)}))
    var containers=Array.from(document.querySelectorAll('[class*="slip"],[class*="bet"],[class*="order"],[class*="panel"], .betslip-container')).filter(c=>c.offsetHeight>50).map(c=>({ className:c.className, html:c.outerHTML }))
    var dataAttrs=Array.from(document.querySelectorAll('[data-test],[data-testid],[data-test-id]')).filter(a=>a.offsetHeight>0).map(a=>({ dataset: { ...a.dataset}, node:a.tagName, className:a.className }))
    var results={ url:location.href, timestamp:(new Date()).toISOString(), inputs:inputs, containers:containers, dataAttributes:dataAttrs, userAgent:navigator.userAgent }
    var title=prompt('Exchange name for issue (e.g. Betfair):', location.hostname)||location.hostname
    var issueBody='**Console JSON:**\n\n\u0060\u0060\u0060json\n'+JSON.stringify(results,null,2)+'\n\u0060\u0060\u0060\n\n**HTML of stake input (closest):**\n\n' + (inputs[0]?('\u0060\u0060\u0060html\n'+inputs[0].html+'\n\u0060\u0060\u0060'):'(none found)') + '\n\n**Steps to reproduce:**\n- Open: '+location.href+'\n- Actions: [add selection, open betslip]\n\n**Browser / OS:** '+navigator.userAgent + '\n\n**Notes:** Please use the Add Exchange Support issue template.'
    var repoUrl='https://github.com/tacticdemonic/surebet-helper-extension/issues/new?template=add-exchange.md&title='+encodeURIComponent('Add Support for '+title)+'&body='+encodeURIComponent(issueBody)+'&labels=enhancement'
    if(issueBody.length>8000){
      // Too long: open a blank issue and ask user to paste
      window.open('https://github.com/tacticdemonic/surebet-helper-extension/issues/new?template=add-exchange.md&title='+encodeURIComponent('Add Support for '+title),'_blank')
      alert('Issue body is too large to auto-fill. A new issue page has been opened — paste the JSON into the Console JSON field.')
      return
    }
    window.open(repoUrl, '_blank')
  })();`;

  console.log('Copy the following string into a new bookmark URL to create the issue bookmarklet:');
  console.log(bookmarklet);
})();


