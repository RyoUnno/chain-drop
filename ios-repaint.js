(function () {
  var board = document.querySelector("#board");
  if (!board) return;

  var activeUntil = 0;
  var framePending = false;
  var paintTick = 0;
  var requestFrame =
    window.requestAnimationFrame ||
    function (callback) {
      return window.setTimeout(function () {
        callback(Date.now());
      }, 16);
    };

  function now() {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
  }

  function forcePaint() {
    paintTick += 1;
    board.dataset.iosPaintTick = String(paintTick);
    board.style.transform = "translateZ(0)";
    board.style.webkitTransform = "translateZ(0)";
    void board.offsetHeight;
  }

  function pump(timestamp) {
    framePending = false;
    forcePaint();
    if (timestamp < activeUntil) {
      queuePump();
    }
  }

  function queuePump() {
    if (framePending) return;
    framePending = true;
    requestFrame(pump);
  }

  function wakePaint() {
    activeUntil = now() + 2600;
    forcePaint();
    queuePump();
  }

  board.addEventListener("pointerup", wakePaint, true);
  board.addEventListener("touchend", wakePaint, true);
  board.addEventListener("click", wakePaint, true);

  if ("MutationObserver" in window) {
    new MutationObserver(wakePaint).observe(board, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-color", "data-asset", "disabled", "aria-disabled"]
    });
  }

  wakePaint();
})();
