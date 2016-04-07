var electron = require('electron');
var app = electron.app;
var Menu = electron.Menu;
var BrowserWindow = electron.BrowserWindow;

var _ = require('underscore-plus');

function ApplicationMenu(version, autoUpdateManager) {
  this.version = version;
  this.autoUpdateManager = autoUpdateManager;
  this.windowTemplates = new WeakMap();
  this.setActiveTemplate(this.getDefaultTemplate());
  this.autoUpdateManager.on('state-changed', (function(_this) {
    return function(state) {
      return _this.showUpdateMenuItem(state);
    };
  })(this));
}

ApplicationMenu.prototype.update = function(window, template, keystrokesByCommand) {
  this.translateTemplate(template, keystrokesByCommand);
  this.substituteVersion(template);
  this.windowTemplates.set(window, template);
  if (window === this.lastFocusedWindow) {
    return this.setActiveTemplate(template);
  }
};

ApplicationMenu.prototype.setActiveTemplate = function(template) {
  if (!_.isEqual(template, this.activeTemplate)) {
    this.activeTemplate = template;
    this.menu = Menu.buildFromTemplate(_.deepClone(template));
    Menu.setApplicationMenu(this.menu);
  }
  return this.showUpdateMenuItem(this.autoUpdateManager.getState());
};

ApplicationMenu.prototype.addWindow = function(window) {
  var focusHandler;
  if (this.lastFocusedWindow == null) {
    this.lastFocusedWindow = window;
  }
  focusHandler = (function(_this) {
    return function() {
      var template;
      _this.lastFocusedWindow = window;
      if (template = _this.windowTemplates.get(window)) {
        return _this.setActiveTemplate(template);
      }
    };
  })(this);
  window.on('focus', focusHandler);
  window.once('closed', (function(_this) {
    return function() {
      if (window === _this.lastFocusedWindow) {
        _this.lastFocusedWindow = null;
      }
      _this.windowTemplates.delete(window);
      return window.removeListener('focus', focusHandler);
    };
  })(this));
  return this.enableWindowSpecificItems(true);
};

ApplicationMenu.prototype.flattenMenuItems = function(menu) {
  var index;
  var item;
  var items;
  var ref1;
  items = [];
  ref1 = menu.items || {};
  for (index in ref1) {
    item = ref1[index];
    items.push(item);
    if (item.submenu) {
      items = items.concat(this.flattenMenuItems(item.submenu));
    }
  }
  return items;
};

ApplicationMenu.prototype.flattenMenuTemplate = function(template) {
  var i;
  var item;
  var items;
  var len;
  items = [];
  for (i = 0, len = template.length; i < len; i++) {
    item = template[i];
    items.push(item);
    if (item.submenu) {
      items = items.concat(this.flattenMenuTemplate(item.submenu));
    }
  }
  return items;
};

ApplicationMenu.prototype.enableWindowSpecificItems = function(enable) {
  var i;
  var item;
  var len;
  var ref1;
  var ref2;
  ref1 = this.flattenMenuItems(this.menu);
  for (i = 0, len = ref1.length; i < len; i++) {
    item = ref1[i];
    if ((ref2 = item.metadata) != null ? ref2.windowSpecific : void 0) {
      item.enabled = enable;
    }
  }
};

ApplicationMenu.prototype.substituteVersion = function(template) {
  var item;
  if ( (item = _.find(this.flattenMenuTemplate(template), function(arg) {
      var label;
      label = arg.label;
      return label === 'VERSION';
    })) ) {
    return item.label = 'Version ' + this.version;
  }
};

ApplicationMenu.prototype.showUpdateMenuItem = function(state) {
  var checkForUpdateItem;
  var checkingForUpdateItem;
  var downloadingUpdateItem;
  var installUpdateItem;
  checkForUpdateItem = _.find(this.flattenMenuItems(this.menu), function(arg) {
    var label;
    label = arg.label;
    return label === 'Check for Update';
  });
  checkingForUpdateItem = _.find(this.flattenMenuItems(this.menu), function(arg) {
    var label;
    label = arg.label;
    return label === 'Checking for Update';
  });
  downloadingUpdateItem = _.find(this.flattenMenuItems(this.menu), function(arg) {
    var label = arg.label;
    return label === 'Downloading Update';
  });

  installUpdateItem = _.find(this.flattenMenuItems(this.menu), function(arg) {
    var label;
    label = arg.label;
    return label === 'Restart and Install Update';
  });

  if (!((checkForUpdateItem != null) && (checkingForUpdateItem != null) && (downloadingUpdateItem != null) && (installUpdateItem != null))) {
    return;
  }
  checkForUpdateItem.visible = false;
  checkingForUpdateItem.visible = false;
  downloadingUpdateItem.visible = false;
  installUpdateItem.visible = false;
  switch (state) {
    case 'idle':
    case 'error':
    case 'no-update-available':
      return checkForUpdateItem.visible = true;
    case 'checking':
      return checkingForUpdateItem.visible = true;
    case 'downloading':
      return downloadingUpdateItem.visible = true;
    case 'update-available':
      return installUpdateItem.visible = true;
    default:
      return checkingForUpdateItem.visible = false;
  }
};

ApplicationMenu.prototype.getDefaultTemplate = function() {
  return [
    {
      label: app.getName(),
      submenu: [
        {
          label: 'Check for Update',
          metadata: {
            autoUpdate: true
          }
        },
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: this.reloadFocusedWindow
        },
        {
          label: 'Close Window',
          accelerator: 'Command+Shift+W',
          click: this.closeFocusedWindow
        },
        {
          label: 'Toggle Dev Tools',
          accelerator: 'Command+Alt+I',
          click: this.toggleDevToolsForFocusedWindow
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: function() {
            return app.quit();
          }
        }
      ]
    }
  ];
};

ApplicationMenu.prototype.focusedWindow = function() {
  return BrowserWindow.getFocusedWindow();
};

ApplicationMenu.prototype.reloadFocusedWindow = function() {
  var _window = this.focusedWindow();
  if (_window) {
    _window.reload();
  }
};

ApplicationMenu.prototype.closeFocusedWindow = function() {
  var _window = this.focusedWindow();
  if (_window) {
    _window.close();
  }
};

ApplicationMenu.prototype.toggleDevToolsForFocusedWindow = function() {
  var _window = this.focusedWindow();
  if (_window) {
    _window.toggleDevTools();
  }
};

ApplicationMenu.prototype.translateTemplate = function(template, keystrokesByCommand) {
  template.forEach((function(_this) {
    return function(item) {
      if (item.metadata === null) {
        item.metadata = {};
      }
      if (item.command) {
        item.accelerator = _this.acceleratorForCommand(item.command, keystrokesByCommand);
        item.click = function() {
          return global.atomApplication.sendCommand(item.command);
        };
        if (!/^application:/.test(item.command)) {
          item.metadata.windowSpecific = true;
        }
      }
      if (item.submenu) {
        return _this.translateTemplate(item.submenu, keystrokesByCommand);
      }
    };
  })(this));
  return template;
};

ApplicationMenu.prototype.acceleratorForCommand = function(command, keystrokesByCommand) {
  var firstKeystroke;
  var key;
  var keys;
  var modifiers;
  var ref1;
  firstKeystroke = (ref1 = keystrokesByCommand[command]) != null ? ref1[0] : void 0;
  if (!firstKeystroke) {
    return null;
  }
  modifiers = firstKeystroke.split(/-(?=.)/);
  key = modifiers.pop().toUpperCase().replace('+', 'Plus');
  modifiers = modifiers.map(function(modifier) {
    return modifier.replace(/shift/ig, 'Shift')
      .replace(/cmd/ig, 'Command')
      .replace(/ctrl/ig, 'Ctrl')
      .replace(/alt/ig, 'Alt');
  });
  keys = modifiers.concat([key]);
  return keys.join('+');
};

module.exports = ApplicationMenu;
