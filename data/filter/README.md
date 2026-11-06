# NeverSink Loot Filter snapshot

- File: `neversink-0.10.4-3strict.txt`
- Version: 0.10.4
- Type: 3-STRICT
- Author: NeverSink
- Source: https://github.com/NeverSinkDev/NeverSink-Filter-for-PoE2
- License: MIT (see upstream `LICENSE`)

Файл используется только как **экспертный prior** для баз и аффиксных комбинаций.
Он не является частью логики крафта и не заменяет правила.

Пересобрать структурированный снимок:

```bash
npm.cmd run filter:priors
```

Результат:

- `data/filter-priors.json` — полный снимок: базовые тиры, Show/Hide-правила;
- `data/filter-base-tiers.json` — компактный индекс баз для рантайма.

Hide-правила сохраняются как снимок фильтра, но **не превращаются в чёрный
список аффиксов**: скрытие зависит от базы, редкости и контекста.
