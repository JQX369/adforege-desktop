(function(){
  try {
    var url = location.href;
    var origin = (location.origin || (location.protocol + '//' + location.host));
    var api = origin + '/api/admin/ingest/urls?url=' + encodeURIComponent(url);
    var w = window.open(api, '_blank');
    if (!w) alert('Pop-up blocked. Please allow pop-ups for this site.');
  } catch (e) {
    alert('Failed to submit URL: ' + (e && e.message));
  }
})();



