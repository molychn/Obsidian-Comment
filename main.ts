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
                menu.addItem((item) => {
                    item
                        .setTitle('创建批注')
                        .setIcon('document-plus')
                        .onClick(async () => {
                            const fileName = `批注-${file.basename}`;
                            const filePath = `${this.settings.commentFolderPath}/${fileName}.md`;
                            
                            try {
                                // 确保目标文件夹存在
                                if (!await this.app.vault.adapter.exists(this.settings.commentFolderPath)) {
                                    await this.app.vault.createFolder(this.settings.commentFolderPath);
                                }
                                if (!await this.app.vault.adapter.exists(filePath)) {
                                    // 添加文件链接到批注文件开头
                                    const content = `批注来源：[[${file.basename}]]\n\n---\n\n`;
                                    await this.app.vault.create(filePath, content);
                                    new Notice(`批注文件已创建：${fileName}`);
                                } else {
                                    new Notice('批注文件已存在！');
                                }
                            } catch (error) {
                                new Notice('创建批注文件失败！');
                                console.error(error);
                            }
                        });
                });
            })
        );

        // 编辑器右键菜单部分
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                const selection = editor.getSelection();
                if (selection && view instanceof MarkdownView) {
                    menu.addItem((item) => {
                        item
                            .setTitle('创建批注')
                            .setIcon('document-plus')
                            .onClick(async () => {
                                const currentFile = view.file;
                                const baseFileName = `批注-${currentFile.basename}`;
                                
                                // 查找现有的批注文件并确定序号
                                const files = this.app.vault.getFiles();
                                let maxIndex = 0;
                                const regex = new RegExp(`^${baseFileName}\\((\\d+)\\)\\.md$`);
                                
                                files.forEach(file => {
                                    const match = file.path.match(regex);
                                    if (match) {
                                        const index = parseInt(match[1]);
                                        maxIndex = Math.max(maxIndex, index);
                                    }
                                });
                                
                                const nextIndex = maxIndex + 1;
                                const fileName = `${baseFileName}(${nextIndex})`;
                                // 使用配置的路径
                                const filePath = `${this.settings.commentFolderPath}/${fileName}.md`;
                                try {
                                    // 确保目标文件夹存在
                                    if (!await this.app.vault.adapter.exists(this.settings.commentFolderPath)) {
                                        await this.app.vault.createFolder(this.settings.commentFolderPath);
                                    }
                                    
                                    if (!await this.app.vault.adapter.exists(filePath)) {
                                        // 创建批注文件
                                        const content = `批注来源：[[${currentFile.basename}]]\n\n---\n\n原文：\n> ${selection}\n\n批注：\n`;
                                        await this.app.vault.create(filePath, content);

                                        // 获取选中文本的起始位置
                                        const cursor = editor.getCursor('from');
                                        const originalContent = await this.app.vault.read(currentFile);
                                        
                                        // 将文本分成三部分并组合
                                        const beforeSelection = originalContent.slice(0, editor.posToOffset(cursor));
                                        const afterSelection = originalContent.slice(editor.posToOffset(cursor) + selection.length);
                                        
                                        // 保留原文，添加批注标识和链接
                                        const newContent = beforeSelection + 
                                            selection +
                                            `[(${nextIndex})](${fileName})` + 
                                            afterSelection;
                                        
                                        await this.app.vault.modify(currentFile, newContent);

                                        // 在新标签页中打开批注文件
                                        const leaf = this.app.workspace.getLeaf('tab');
                                        await leaf.openFile(await this.app.vault.getAbstractFileByPath(filePath));
                                        new Notice(`批注文件已创建：${fileName}`);
                                    }
                                } catch (error) {
                                    new Notice('创建批注文件失败！');
                                    console.error(error);
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
