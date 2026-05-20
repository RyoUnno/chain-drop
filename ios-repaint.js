(function () {
  var board = document.querySelector("#board");
  if (!board) return;

  var paintTick = 0;
  var pumpToken = 0;
  var requestFrame =
    window.requestAnimationFrame ||
    function (callback) {
      return window.setTimeout(function () {
        callback(Date.now());
      }, 16);
    };

  function forcePaint() {
    paintTick += 1;
    board.dataset.iosPaintTick = String(paintTick);
    void board.offsetHeight;
  }

  function wakePaint(frames) {
    var token = (pumpToken += 1);
    var remaining = Math.max(2, Math.min(Number(frames) || 6, 12));
    forcePaint();

    function pump() {
      if (token !== pumpToken) return;
      forcePaint();
      remaining -= 1;
      if (remaining > 0) requestFrame(pump);
    }

    requestFrame(pump);
  }

  window.ChainDropRepaint = { wake: wakePaint };
  board.addEventListener("click", function () {
    wakePaint(8);
  }, true);

  if ("MutationObserver" in window) {
    var observerQueued = false;
    new MutationObserver(function () {
      if (observerQueued) return;
      observerQueued = true;
      requestFrame(function () {
        observerQueued = false;
        wakePaint(4);
      });
    }).observe(board, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-color", "data-asset", "disabled", "aria-disabled"]
    });
  }

  wakePaint();
})();
