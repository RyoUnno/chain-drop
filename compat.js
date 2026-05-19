(function () {
  if (!Object.fromEntries) {
    Object.fromEntries = function (entries) {
      var result = {};
      for (var i = 0; i < entries.length; i += 1) {
        result[entries[i][0]] = entries[i][1];
      }
      return result;
    };
  }

  if (!Array.prototype.flat) {
    Object.defineProperty(Array.prototype, "flat", {
      configurable: true,
      value: function () {
        var result = [];
        for (var i = 0; i < this.length; i += 1) {
          if (Array.isArray(this[i])) {
            for (var j = 0; j < this[i].length; j += 1) {
              result.push(this[i][j]);
            }
          } else {
            result.push(this[i]);
          }
        }
        return result;
      },
    });
  }
})();
