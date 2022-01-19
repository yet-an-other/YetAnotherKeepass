/* eslint-disable class-methods-use-this */
import fs from 'fs';
import { BrowserWindow, dialog, ipcMain, IpcMainEvent } from 'electron';
import { Credentials, CryptoEngine, Kdbx, KdbxError, ProtectedValue } from 'kdbxweb';
import { RenderSetting } from '../entity/RenderSetting';
import { ReadKdbxResult } from '../entity/ReadKdbxResult';
import { YakpError } from '../entity/YakpError';
import { argon2Hash } from '../argon';
import { Setting } from '../entity/Setting';
import { YaKeepassSetting } from '../entity/YaKeepassSetting';
import { IpcChannels } from './IpcChannels';

export type SystemCommand = 'minimize' | 'maximize' | 'restore' | 'exit';

export class IpcDispatcher {
  private yaKeepassSetting: YaKeepassSetting;

  constructor(yaKeepassSetting: YaKeepassSetting) {
    this.yaKeepassSetting = yaKeepassSetting;
    this.onReadKdbx = this.onReadKdbx.bind(this);
    this.onOpenFile = this.onOpenFile.bind(this);
    this.onSettings = this.onSettings.bind(this);
    this.onSystemCommand = this.onSystemCommand.bind(this);
    this.subscribeOnIpcEvents = this.subscribeOnIpcEvents.bind(this);
  }

  subscribeOnIpcEvents() {
    ipcMain.on(IpcChannels.openFile, this.onOpenFile);
    ipcMain.on(IpcChannels.settings, (event, setting?: RenderSetting) => this.onSettings(event, setting));
    ipcMain.on(IpcChannels.readKdbx, (event, kdbxFilePath: string, value: Uint8Array, salt: Uint8Array) =>
      this.onReadKdbx(event, kdbxFilePath, value, salt)
    );
    ipcMain.on(IpcChannels.systemCommand, (_, command: SystemCommand) => this.onSystemCommand(command));
  }

  async onSystemCommand(command: SystemCommand) {
    switch (command) {
      case 'exit':
        BrowserWindow.getFocusedWindow()?.close();
        break;
      case 'minimize':
        BrowserWindow.getFocusedWindow()?.minimize();
        break;
      case 'maximize':
        BrowserWindow.getFocusedWindow()?.maximize();
        break;
      case 'restore':
        BrowserWindow.getFocusedWindow()?.restore();
        break;
      default:
        throw Error('unknown command');
    }
  }

  async onOpenFile(event: IpcMainEvent) {
    const fileName = dialog.showOpenDialogSync({ properties: ['openFile'] });
    event.reply(IpcChannels.openFile, fileName ? fileName[0] : '');
  }

  async onSettings(event: IpcMainEvent, renderSetting?: RenderSetting) {
    if (renderSetting) {
      this.yaKeepassSetting.renderSetting = renderSetting;
      Setting.save(this.yaKeepassSetting);
    } else {
      event.reply(IpcChannels.settings, this.yaKeepassSetting.renderSetting);
    }
  }

  async onReadKdbx(event: IpcMainEvent, kdbxFilePath: string, value: Uint8Array, salt: Uint8Array) {
    const password = new ProtectedValue(value, salt);
    console.log(password.getText());
    console.log(`file ${kdbxFilePath}`);

    try {
      CryptoEngine.setArgon2Impl((...args) => argon2Hash(...args));
      const data = await fs.promises.readFile(kdbxFilePath);
      const credentials = new Credentials(password, null);
      const database = await Kdbx.load(new Uint8Array(data).buffer, credentials);

      const item = database.getDefaultGroup();

      event.reply(IpcChannels.readKdbx, ReadKdbxResult.fromResult(item, kdbxFilePath));
    } catch (e) {
      const error: YakpError =
        e instanceof KdbxError ? new YakpError(e.code, e.message) : new YakpError('GenericError', e as string);
      event.reply(IpcChannels.readKdbx, ReadKdbxResult.fromError(error));
    }
  }
}