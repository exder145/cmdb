#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import json
import re

def format_json_file(file_path):
    """格式化JSON文件
    
    Args:
        file_path (str): JSON文件路径
    """
    try:
        # 读取JSON文件
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # 如果文件内容为空，直接返回
            if not content.strip():
                print(f"文件为空: {file_path}")
                return
                
            # 尝试解析JSON
            try:
                data = json.loads(content)
            except json.JSONDecodeError:
                # 如果解析失败，尝试修复格式
                # 1. 移除可能的BOM标记
                content = content.lstrip('\ufeff')
                
                # 2. 检查文件是否包含对象列表但缺少数组括号
                if content.strip().startswith('{') and not content.strip().startswith('['):
                    # 如果以 { 开头但不是 [ 开头，说明缺少数组括号
                    # 先移除所有换行符和多余的空格
                    content = content.replace('\n', '').replace('\r', '')
                    # 移除末尾可能存在的逗号
                    content = content.rstrip(',')
                    # 添加数组括号
                    content = '[' + content + ']'
                else:
                    # 如果不是上述情况，只移除换行符
                    content = content.replace('\n', '').replace('\r', '')
                
                # 3. 重新尝试解析
                data = json.loads(content)
        
        # 格式化并写回文件
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"已格式化: {file_path}")
        
    except json.JSONDecodeError as e:
        print(f"JSON格式错误: {file_path}")
        print(f"错误详情: {str(e)}")
        print(f"文件内容预览: {content[:200]}...")  # 打印文件内容预览以便调试
    except Exception as e:
        print(f"处理文件时出错: {file_path}, 错误: {e}")

def main():
    # 检查test/price目录
    price_dir = os.path.join('..', 'test', 'price')
    if not os.path.exists(price_dir):
        price_dir = os.path.join('test', 'price')
    
    if not os.path.exists(price_dir):
        print(f"目录不存在: {price_dir}")
        return
    
    # 遍历所有年份目录
    for year in os.listdir(price_dir):
        year_dir = os.path.join(price_dir, year)
        if not os.path.isdir(year_dir):
            continue
            
        print(f"\n处理{year}年数据...")
        
        # 处理该年份下的所有JSON文件
        for file in os.listdir(year_dir):
            if file.endswith('.json'):
                file_path = os.path.join(year_dir, file)
                format_json_file(file_path)

if __name__ == "__main__":
    main() 