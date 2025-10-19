import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Menu, TFile } from 'obsidian';

interface TraePluginSettings {
    commentFolderPath: string; // 批注文件存放路径
}

const DEFAULT_SETTINGS: TraePluginSettings = {
    commentFolderPath: '批注' // 默认存放在批注文件夹
}

export default class TraePlugin extends Plugin {
    settings: TraePluginSettings;

    async onload() {
        await this.loadSettings();
    // 添加设置标签页
    this.addSettingTab(new TraeSettingTab(this.app, this));
    // 文件右键菜单
    this.registerEvent(
        this.app.workspace.on('file-menu', (menu, file) => {
            if (file instanceof TFile) {
                menu.addItem((item) => {
                    item
                        .setTitle('创建批注')
                        .setIcon('document-plus')
                        .onClick(async () => {
                            const fileName = `批注-${file.basename}.md`;
                            const filePath = `${this.settings.commentFolderPath}/${fileName}`;

                            try {
                                if (!await this.app.vault.adapter.exists(this.settings.commentFolderPath)) {
                                    await this.app.vault.createFolder(this.settings.commentFolderPath);
                                }

                                const existingFile = this.app.vault.getAbstractFileByPath(filePath);
                                if (existingFile) {
                                    new Notice('批注文件已存在，正在打开...');
                                    const leaf = this.app.workspace.getLeaf('tab');
                                    await leaf.openFile(existingFile as TFile);
                                    return;
                                }
                                
                                const content = `批注来源：[[${file.name}]]\\n\\n---\\n\\n`;
                                const newFile = await this.app.vault.create(filePath, content);
                                new Notice(`批注文件已创建：${fileName}`);
                                
                                const leaf = this.app.workspace.getLeaf('tab');
                                await leaf.openFile(newFile);

                            } catch (error) {
                                new Notice(`创建或打开批注文件失败：${filePath}`);
                                console.error(error);
                            }
                        });
                });
            }
        })
    );

    // 编辑器右键菜单部分
    this.registerEvent(
        this.app.workspace.on('editor-menu', (menu, editor, view) => {
            const selection = editor.getSelection();
            if (selection && view.file) {
                menu.addItem((item) => {
                    item
                        .setTitle('创建批注')
                        .setIcon('document-plus')
                        .onClick(async () => {
                            const currentFile = view.file;
                            if (!currentFile) {
                                new Notice("无法获取当前文件。");
                                return;
                            }

                            const baseFileName = `批注-${currentFile.basename}`;
                            const folderPath = this.settings.commentFolderPath;

                            if (!await this.app.vault.adapter.exists(folderPath)) {
                                await this.app.vault.createFolder(folderPath);
                            }

                            let nextIndex = 1;
                            let fileNameWithExt: string;
                            let filePath: string;
                            
                            // 使用循环找到一个不存在的文件名
                            while (true) {
                                fileNameWithExt = `${baseFileName}(${nextIndex}).md`;
                                filePath = `${folderPath}/${fileNameWithExt}`;
                                const fileExists = await this.app.vault.adapter.exists(filePath);
                                if (!fileExists) {
                                    break; // 找到一个可用的文件名
                                }
                                nextIndex++; // 如果文件已存在，则序号加1
                            }

                            try {
                                const selection = editor.getSelection();
                                const content = `批注来源：[[${currentFile.name}]]\n\n---\n\n原文：\n> ${selection}\n\n批注：\n`;
                                const newFile = await this.app.vault.create(filePath, content);

                                // 在原文中插入链接
                                const fileNameWithoutExt = `${baseFileName}(${nextIndex})`;
                                editor.replaceSelection(`${selection}[(${nextIndex})](${fileNameWithoutExt})`);

                                new Notice(`批注文件已创建：${fileNameWithExt}`);
                                const leaf = this.app.workspace.getLeaf('tab');
                                await leaf.openFile(newFile);

                            } catch (error) {
                                new Notice(`创建批注文件失败，请检查路径和权限： ${filePath}`);
                                console.error("创建批注文件失败:", error);
                            }
                        });
                });
            }
        })
        );
    }
	onunload() {
		// 插件卸载时的清理工作
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TraeSettingTab extends PluginSettingTab {
    plugin: TraePlugin;

    constructor(app: App, plugin: TraePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.createEl('h2', {text: '批注插件设置'});

        new Setting(containerEl)
            .setName('批注文件存放路径')
            .setDesc('设置批注文件的存放路径（相对于库的根目录）')
            .addText(text => text
                .setPlaceholder('批注')
                .setValue(this.plugin.settings.commentFolderPath)
                .onChange(async (value) => {
                    this.plugin.settings.commentFolderPath = value;
                    await this.plugin.saveSettings();
                }));
    }
}
