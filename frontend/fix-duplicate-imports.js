const fs = require('fs');
const path = require('path');

const UI_COMPONENTS_DIR = path.join(__dirname, 'src/components/ui');

console.log('开始修复组件文件中的重复导入...');

// 读取UI组件目录中的所有文件
const files = fs.readdirSync(UI_COMPONENTS_DIR);

files.forEach(file => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    const filePath = path.join(UI_COMPONENTS_DIR, file);
    console.log(`处理文件: ${file}`);

    // 读取文件内容
    let content = fs.readFileSync(filePath, 'utf8');

    // 检查是否有重复的React导入
    if (content.includes('import * as React from "react"')) {
      // 删除所有React导入
      content = content.replace(/import \* as React from "react";?\n?/g, '');

      // 在文件开头添加一个干净的React导入
      content = 'import * as React from "react";\n\n' + content;
    }

    // 检查其他常见的重复导入
    const commonImports = [
      'import { cn } from "@/lib/utils"',
      'import { cva, type VariantProps } from "class-variance-authority"'
    ];

    commonImports.forEach(importStr => {
      if (content.includes(importStr)) {
        // 移除所有此类导入
        const regex = new RegExp(`${importStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};?\\n?`, 'g');
        content = content.replace(regex, '');

        // 重新添加一次
        if (!content.includes(importStr)) {
          const afterReactImport = content.indexOf('import * as React from "react";') + 'import * as React from "react";'.length;
          content = content.substring(0, afterReactImport) + '\n' + importStr + ';\n' + content.substring(afterReactImport);
        }
      }
    });

    // 写回文件
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`已修复: ${file}`);
  }
});

console.log('所有文件处理完成!');
