# 瞬発キャプチャ用テンプレ
```
@type: scratch
@intent: learning | decision | memo
@status: raw

一言：
DTO分けた方が良さそう

理由：
レスポンスに変更入りそう

```

# 昇格後フォーマット
```
@type: learning
@status: refined

テーマ：
DTOとEntityの分離

解決する問題：
ドメイン汚染・責務肥大

使う場面：
- API境界
- 外部I/O

使わない：
- 超小規模CRUD

一言：
外と話すならDTO
```

# scratch → decision
```
@type: decision
@status: refined

状況：
APIレスポンス設計

選択肢：
- Entity直返し
- DTO導入

判断：
DTO導入

理由：
将来の仕様変更耐性

参照：
- DTOとEntityの分離
```
