'use babel';

import TableEditor from './basic-csv';
import path from 'path';

export default {
  activate() {
    console.log('🚨 BASIC CSV PACKAGE ACTIVATED 🚨');
    console.log('pulsar-basic-csv activated')
    this.opener = atom.workspace.addOpener(uri => {
      const ext = path.extname(uri).toLowerCase();
      if (ext === '.csv' || ext === '.tsv') {
        return new TableEditor(uri);
      }
    });
  },

  deactivate() {
    if (this.opener) {
      this.opener.dispose();
    }
  }
};
