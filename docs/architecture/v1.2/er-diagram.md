# 山隐茶事 V1.2 ER 图

> 逻辑实体范围以 `schema.prisma` 为准。金额交易字段统一为整数“分”；采购单价和成本快照为 `DECIMAL(18,6)` 元；原料数量为 `DECIMAL(18,3)`，单位由 Material.unit 固定，不做隐式换算。

```mermaid
erDiagram
    Merchant ||--o{ Store : owns
    User ||--o{ Staff : has_staff_profile
    Store ||--o{ Staff : employs

    Store ||--o| StoreOrderPolicy : configures
    Store ||--o{ Category : has
    Category ||--o{ Product : groups
    Store ||--o{ Product : sells
    Product ||--o{ ProductVariant : offers

    ProductVariant ||--o{ RecipeVersion : versions
    ProductVariant o|--o| RecipeVersion : active_recipe
    RecipeVersion ||--o{ VariantRecipe : contains
    Material ||--o{ VariantRecipe : consumed_by

    ProductVariant ||--o{ VariantOptionGroup : configures
    VariantOptionGroup ||--o{ VariantOptionValue : has
    RecipeVersion ||--o{ RecipeModifier : adjusts
    VariantOptionValue ||--o{ RecipeModifier : triggers
    Material ||--o{ RecipeModifier : modifies

    Store ||--o{ Material : stocks
    Material ||--o{ StockMovement : movement_facts
    Material ||--o{ LossRecord : loss_facts

    Store ||--o{ DiningTable : owns
    DiningTable ||--o{ DiningSession : historical_sessions
    DiningTable o|--o| DiningSession : active_session
    DiningSession ||--o{ Order : contains
    User ||--o{ Order : places
    DiningTable ||--o{ Order : dine_orders

    Order ||--o{ OrderItem : contains
    Product ||--o{ OrderItem : snapshot_reference
    ProductVariant ||--o{ OrderItem : snapshot_reference
    RecipeVersion o|--o{ OrderItem : snapshot_reference
    OrderItem ||--o{ OrderItemOption : selected_options
    VariantOptionValue ||--o{ OrderItemOption : option_reference
    OrderItem ||--o{ OrderItemMaterial : material_snapshots
    Material ||--o{ OrderItemMaterial : snapshot_reference

    Order ||--o{ StockMovement : causes
    OrderItem o|--o{ StockMovement : optional_detail
    Order ||--o{ LossRecord : causes
    OrderItem o|--o{ LossRecord : optional_detail

    DiningSession ||--o{ PaymentRecord : session_payments
    Order ||--o{ PaymentRecord : takeaway_payments
    Staff o|--o{ PaymentRecord : records
    PaymentRecord ||--o{ RefundRecord : refunds
    Staff o|--o{ RefundRecord : registers

    DiningSession ||--o{ DiscountAllocation : allocates
    OrderItem ||--o{ DiscountAllocation : receives

    Store ||--o{ IdempotencyRecord : protects
    Store ||--o{ AuditLog : audits
    User o|--o{ AuditLog : actor
    Staff o|--o{ AuditLog : actor

    Merchant {
        bigint id PK
        varchar name
        enum status
        datetime deletedAt
    }
    Store {
        bigint id PK
        bigint merchantId FK
        varchar name
        enum status
        varchar timezone
        int businessDayCutoffMinute
    }
    StoreOrderPolicy {
        bigint id PK
        bigint storeId FK_UK
        int pendingReminderMinutes
        int maxPendingOrdersPerCustomer
        int maxPendingOrdersPerSession
    }
    User {
        bigint id PK
        varchar openid UK
        varchar unionid
        enum status
    }
    Staff {
        bigint id PK
        bigint userId FK
        bigint storeId FK
        enum role
        enum status
    }
    Category {
        bigint id PK
        bigint storeId FK
        varchar name
        int sortOrder
        enum status
    }
    Product {
        bigint id PK
        bigint storeId FK
        bigint categoryId FK
        varchar name
        enum status
        datetime deletedAt
    }
    ProductVariant {
        bigint id PK
        bigint productId FK
        varchar name
        int priceFen
        enum inventoryMode
        bigint activeRecipeVersionId FK_UK
    }
    RecipeVersion {
        bigint id PK
        bigint variantId FK
        int versionNo
        enum status
        datetime effectiveAt
    }
    VariantRecipe {
        bigint id PK
        bigint recipeVersionId FK
        bigint materialId FK
        enum role
        decimal quantity
    }
    VariantOptionGroup {
        bigint id PK
        bigint variantId FK
        varchar code
        enum selectionType
        boolean required
    }
    VariantOptionValue {
        bigint id PK
        bigint optionGroupId FK
        varchar code
        varchar name
        int priceDeltaFen
    }
    RecipeModifier {
        bigint id PK
        bigint recipeVersionId FK
        bigint optionValueId FK
        bigint materialId FK
        enum targetRole
        decimal quantityDelta
    }
    Material {
        bigint id PK
        bigint storeId FK
        varchar name
        varchar unit
        decimal onHand
        decimal reserved
        decimal warningThreshold
        decimal purchasePricePerUnit
        int version
    }
    StockMovement {
        bigint id PK
        varchar dedupeKey UK
        bigint storeId FK
        bigint materialId FK
        enum movementType
        decimal quantityDelta
        decimal reservedDelta
        decimal onHandAfter
        decimal reservedAfter
        bigint orderId FK
        datetime createdAt
    }
    LossRecord {
        bigint id PK
        varchar dedupeKey UK
        bigint storeId FK
        bigint materialId FK
        bigint orderId FK
        bigint orderItemId FK
        decimal quantity
        decimal unitCostSnapshot
        decimal lossCostSnapshot
        datetime occurredAt
    }
    DiningTable {
        bigint id PK
        bigint storeId FK
        varchar name
        varchar code
        int capacity
        bigint activeSessionId FK_UK
    }
    DiningSession {
        bigint id PK
        bigint storeId FK
        bigint tableId FK
        enum status
        int discountFen
        int discountVersion
        datetime allocationFinalizedAt
        int version
    }
    Order {
        bigint id PK
        bigint storeId FK
        bigint customerUserId FK
        varchar orderNo UK
        enum channel
        bigint tableId FK
        bigint sessionId FK
        enum status
        int subtotalFen
        int discountFen
        int totalAmountFen
        int version
        datetime completedAt
    }
    OrderItem {
        bigint id PK
        bigint orderId FK
        bigint productId FK
        bigint variantId FK
        bigint recipeVersionId FK
        varchar productNameSnapshot
        varchar variantNameSnapshot
        int unitPriceFen
        int quantity
        int lineSubtotalFen
        varchar strengthSnapshot
        varchar brewingMethodSnapshot
    }
    OrderItemOption {
        bigint id PK
        bigint orderItemId FK
        bigint optionValueId FK
        varchar groupCodeSnapshot
        varchar valueCodeSnapshot
        int priceDeltaFenSnapshot
    }
    OrderItemMaterial {
        bigint id PK
        bigint orderItemId FK
        bigint materialId FK
        varchar materialNameSnapshot
        varchar unitSnapshot
        decimal quantityPerItem
        decimal totalQuantity
        decimal unitCostSnapshot
        decimal totalCostSnapshot
        enum source
    }
    PaymentRecord {
        bigint id PK
        bigint storeId FK
        bigint sessionId FK
        bigint orderId FK
        int amountFen
        datetime receivedAt
        enum status
        datetime voidedAt
    }
    RefundRecord {
        bigint id PK
        bigint paymentRecordId FK
        int amountFen
        enum status
        datetime refundedAt
        datetime voidedAt
    }
    DiscountAllocation {
        bigint id PK
        bigint sessionId FK
        bigint orderItemId FK
        int allocationVersion
        int basisAmountFen
        int discountFen
        boolean isFinal
    }
    IdempotencyRecord {
        bigint id PK
        bigint storeId FK
        varchar idempotencyKey
        varchar endpoint
        char requestHash
        enum status
        datetime expiresAt
    }
    AuditLog {
        bigint id PK
        bigint storeId FK
        enum actorType
        bigint actorUserId FK
        bigint actorStaffId FK
        varchar action
        varchar targetType
        varchar targetId
        json beforeData
        json afterData
        datetime createdAt
    }
```

## 约束图例

- `PK`：主键。
- `FK`：外键。
- `UK`：唯一约束。
- `DiningTable.activeSessionId` 唯一，配合行锁形成同桌唯一活动桌单的第一道约束。
- `PaymentRecord` 的 `sessionId` 与 `orderId` 必须且只能有一个非空，由补充 CHECK 约束保证。
- `StockMovement.dedupeKey` 唯一，防止同一业务动作重复写库存流水。
- `LossRecord.dedupeKey` 唯一，防止同一制作后取消重复记损耗。
