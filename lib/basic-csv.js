'use babel';

import fs from 'fs';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_RENDER_ROWS = 1000;

export default class TableEditor {
  constructor(filePath) {
    this.filePath = filePath;
    this.delimiter = filePath.endsWith('.tsv') ? '\t' : ',';

    this.modified = false;
    this.hasHeader = false;

    this.undoStack = [];
    this.redoStack = [];

    // Large-file fallback
    const stats = fs.statSync(this.filePath);
    if (stats.size > MAX_FILE_SIZE) {
      atom.workspace.open(this.filePath, { searchAllPanes: true });
      return;
    }

    this.element = document.createElement('div');
    this.element.classList.add('basic-csv-editor');

    this.loadFile();
  }

  // --------------------------
  // Required Pulsar editor API
  // --------------------------

  getElement() {
    return this.element;
  }

  getTitle() {
    return this.filePath.split('/').pop();
  }

  getURI() {
    return this.filePath;
  }

  isModified() {
    return this.modified;
  }

  shouldPromptToSave() {
    return this.isModified();
  }

  serialize() {
    return { filePath: this.filePath };
  }

  destroy() {
    this.element.remove();
  }

  // --------------------------
  // File loading / saving
  // --------------------------

  loadFile() {
    const text = fs.readFileSync(this.filePath, 'utf8');

    this.data = text
      .split(/\r?\n/)
      .filter(line => line.length > 0)
      .map(line => line.split(this.delimiter));

    this.isLarge = this.data.length > MAX_RENDER_ROWS;
    this.render(0);
  }

  setModified(state = true) {
    this.modified = state;
  }

  serializeData() {
    return this.data
      .map(row =>
        row.map(cell => String(cell).replace(/\n/g, ' ')).join(this.delimiter)
      )
      .join('\n');
  }

  save() {
    fs.writeFileSync(this.filePath, this.serializeData(), 'utf8');
    this.setModified(false);
  }

  saveAs() {
    this.save();
  }

  // --------------------------
  // Undo / Redo
  // --------------------------

  snapshot() {
    this.undoStack.push(JSON.stringify(this.data));
    this.redoStack = [];
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.data));
    this.data = JSON.parse(this.undoStack.pop());
    this.render(0);
    this.setModified(true);
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.data));
    this.data = JSON.parse(this.redoStack.pop());
    this.render(0);
    this.setModified(true);
  }

  // --------------------------
  // Table editing actions
  // --------------------------

  insertRow() {
    this.snapshot();
    const cols = this.data[0]?.length || 1;
    this.data.push(new Array(cols).fill(''));
    this.setModified(true);
    this.render(0);
  }

  insertColumn() {
    this.snapshot();
    this.data.forEach(row => row.push(''));
    this.setModified(true);
    this.render(0);
  }

  toggleHeader() {
    this.hasHeader = !this.hasHeader;
    this.render(0);
  }

  // --------------------------
  // Rendering
  // --------------------------

  render(startRow = 0) {
    this.element.innerHTML = '';

    if (this.isLarge) {
      const notice = document.createElement('div');
      notice.classList.add('table-editor-notice');
      notice.textContent = `Large file — showing ${MAX_RENDER_ROWS} rows at a time`;
      this.element.appendChild(notice);
    }

    const table = document.createElement('table');
    table.classList.add('table-editor-table');

    const rows = this.data.slice(startRow, startRow + MAX_RENDER_ROWS);

    rows.forEach((row, r) => {
      const tr = document.createElement('tr');

      row.forEach((cell, c) => {
        const td = document.createElement('td');
        td.contentEditable = true;
        td.textContent = cell;

        if (this.hasHeader && startRow + r === 0) {
          td.classList.add('header-cell');
        }

        td.addEventListener('focus', () => this.snapshot());

        td.addEventListener('input', () => {
          this.data[startRow + r][c] = td.textContent;
          this.setModified(true);
        });

        td.addEventListener('keydown', e => this.handleKey(e, td));

        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    this.element.appendChild(table);
  }

  // --------------------------
  // Keyboard navigation
  // --------------------------

  handleKey(e, cell) {
    const tr = cell.parentElement;
    const table = tr.parentElement;
    const col = cell.cellIndex;
    const row = tr.rowIndex;

    const focusCell = (r, c) => {
      table.rows[r]?.cells[c]?.focus();
    };

    switch (e.key) {
      case 'ArrowRight':
        focusCell(row, col + 1);
        break;
      case 'ArrowLeft':
        focusCell(row, col - 1);
        break;
      case 'ArrowDown':
        focusCell(row + 1, col);
        break;
      case 'ArrowUp':
        focusCell(row - 1, col);
        break;
      case 'Enter':
        e.preventDefault();
        focusCell(row + 1, col);
        break;
      default:
        return;
    }

    e.preventDefault();
  }
}
