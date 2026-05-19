(function () {
  if (window.CHAIN_DROP_HAS_DIRECT_TAP) return;

  var lastForwardedTouch = 0;
  var selector = ".cell, #pauseButton, #restartButton, #shuffleButton";

  function closestTarget(node) {
    while (node && node !== document) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  document.addEventListener(
    "touchend",
    function (event) {
      var target = event.target.closest ? event.target.closest(selector) : closestTarget(event.target);
      if (!target || target.disabled) return;

      lastForwardedTouch = Date.now();
      if (event.cancelable) event.preventDefault();
      target.click();
    },
    { passive: false }
  );

  document.addEventListener(
    "click",
    function (event) {
      if (event.isTrusted && Date.now() - lastForwardedTouch < 500) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
})();
