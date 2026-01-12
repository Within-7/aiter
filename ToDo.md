1. 应用经常会自己弹出一个报错弹窗，显示信息是："Update Failed \n Failed to fetch release info"。请帮我分析研究详细Debug。
“Current Version: 0.1.45 → Latest Version: 0.1.45”

2. 在`settings`里面，`QWEN-ASR SETTINGS`的`API Key`的输入框样式和整体不搭配，请优化。

4. 
- 将所有换行符（\r\n, \n, \r）替换为空格可能不能满足输入的本意，是不是在Terminal下替换成` \` + 回车 从而保持换行更好？
- 将 Tab 字符替换为空格（防止触发终端自动补全），是不是将 Tab 替换为2个或者4个空格保持格式更好？
- 移除控制字符（防止 Ctrl+C/D 等意外中断），如果我文本中有`Ctrl + C/D`这样的文字输入可以支持吗？



## minto
1. 安全策略思考： 在 Minto 在执行过程中，如果要创建、修改、删除、执行超出当前文件夹以外的文件，是不是必须要拿到用户授权？当前策略是什么样的？需要迭代优化吗？