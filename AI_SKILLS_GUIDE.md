# NewsNow AI 调用指南

本指南介绍如何将 NewsNow 的资讯聚合能力封装为 Skill (工具)，供 AI Agent (如 ChatGPT, Claude, 或自定义 Bot) 在局域网内调用。

**Server 地址**: `http://localhost:4444`（按实际部署地址替换）

---

## 1. Skill 定义 (JSON Schema)

将此 Schema 提供给你的 AI 模型配置 (如 OpenAI Function Calling / Tools)。

### Tool: `get_news`

**描述**: 获取指定来源 (Source) 的最新或热门资讯列表。

```json
{
  "type": "function",
  "function": {
    "name": "get_news",
    "description": "获取特定来源的最新或热门新闻资讯。支持知乎、微博、V2EX、GitHub 等多种来源。",
    "parameters": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "资讯源 ID。常用 ID 如下：\n- 'zhihu': 知乎热榜\n- 'weibo': 微博热搜\n- 'v2ex': V2EX 热门\n- 'github': GitHub Trending\n- '36kr': 36氪\n- 'juejin': 掘金\n- 'toutiao': 今日头条\n- 'bilibili': Bilibili 热门\n- 'douyin': 抖音热榜\n- 'ithome': IT之家",
          "enum": [
            "zhihu", "weibo", "v2ex", "github", "36kr",
            "juejin", "toutiao", "bilibili", "douyin", "ithome",
            "sspai", "coolapk"
          ]
        },
        "latest": {
          "type": "boolean",
          "description": "是否强制刷新获取最新数据 (默认为 false，优先使用缓存)",
          "default": false
        }
      },
      "required": ["id"]
    }
  }
}
```

### Tool: `get_sources`

**描述**: 获取所有支持的资讯源列表，包含 ID、名称和描述。

```json
{
  "type": "function",
  "function": {
    "name": "get_sources",
    "description": "获取所有可用的资讯源列表。当用户询问“有哪些新闻源”或需要列出支持的平台时使用。",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  }
}
```

---

## 2. 实现代码示例 (Python)

当 AI 决定调用 `get_news` 或 `get_sources` 工具时，你的后端系统需要执行实际的 HTTP 请求。

```python
import requests
import json

# 配置局域网内的 Server 地址
BASE_URL = "http://localhost:4444"

def get_sources():
    """
    获取源列表
    """
    url = f"{BASE_URL}/api/sources"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        # 简化返回，只返回 id 和 name
        simplified = [{"id": s["id"], "name": s["name"]} for s in data]
        return json.dumps(simplified, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})

def get_news(id: str, latest: bool = False):
    """
    实际执行 API 调用的函数
    """
    url = f"{BASE_URL}/api/s"
    params = {
        "id": id,
        "latest": "true" if latest else "false"
    }

    try:
        print(f"Fetching news from {id}...")
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()

        # 检查响应状态
        if data.get("status") not in ["success", "cache"]:
            return json.dumps({"error": "Failed to fetch data", "details": data})

        # 提取并简化数据，减少 Token 消耗
        items = data.get("items", [])
        simplified_items = []

        # 仅返回前 10-15 条
        for item in items[:15]:
            simplified_items.append({
                "title": item.get("title"),
                "url": item.get("url"),
                # 可选：如果需要摘要，可以包含 description
                # "summary": item.get("description", "")[:100]
            })

        return json.dumps({
            "source": data.get("id"),
            "updated_at": data.get("updatedTime"),
            "articles": simplified_items
        }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": str(e)})

# --- 本地测试 ---
if __name__ == "__main__":
    # 测试获取知乎热榜
    print(get_news("zhihu"))
```

---

## 3. 直接 API 调用参考

如果你不使用 Function Calling，也可以直接通过 HTTP 调用。

**Endpoint**: `GET /api/s`

| 参数 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | string | 是 | 资讯源 ID (如 `zhihu`) |
| `latest` | string | 否 | 设为 `true` 强制刷新 |

**示例 URL**:
`http://localhost:4444/api/s?id=weibo`

---

## 4. MCP (Model Context Protocol)

该服务也提供了 MCP 兼容的 Endpoint，如果你有支持 HTTP MCP 的客户端：

*   **Endpoint**: `http://localhost:4444/api/mcp`
*   **Method**: `POST`
*   **Tool Name**: `get_hotest_latest_news`
