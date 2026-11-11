-- CreateTable
CREATE TABLE `merchants` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `merchants_status_deletedAt_idx`(`status`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stores` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `merchantId` BIGINT NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    `businessDayCutoffMinute` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `stores_merchantId_status_deletedAt_idx`(`merchantId`, `status`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `openid` VARCHAR(128) NULL,
    `unionid` VARCHAR(128) NULL,
    `nickname` VARCHAR(80) NULL,
    `avatarUrl` VARCHAR(512) NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_openid_key`(`openid`),
    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` BIGINT NOT NULL,
    `storeId` BIGINT NOT NULL,
    `role` ENUM('OWNER', 'MANAGER', 'STAFF') NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `staff_storeId_status_role_idx`(`storeId`, `status`, `role`),
    UNIQUE INDEX `staff_storeId_userId_key`(`storeId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_order_policies` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `storeId` BIGINT NOT NULL,
    `pendingReminderMinutes` INTEGER NOT NULL DEFAULT 10,
    `maxPendingOrdersPerCustomer` INTEGER NOT NULL DEFAULT 5,
    `maxPendingOrdersPerSession` INTEGER NOT NULL DEFAULT 30,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_order_policies_storeId_key`(`storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `storeId` BIGINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `categories_storeId_status_sortOrder_idx`(`storeId`, `status`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `storeId` BIGINT NOT NULL,
    `categoryId` BIGINT NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(512) NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `products_storeId_categoryId_status_sortOrder_idx`(`storeId`, `categoryId`, `status`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `productId` BIGINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `priceFen` INTEGER NOT NULL,
    `inventoryMode` ENUM('MANAGED', 'UNMANAGED') NOT NULL DEFAULT 'MANAGED',
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `activeRecipeVersionId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `product_variants_activeRecipeVersionId_key`(`activeRecipeVersionId`),
    INDEX `product_variants_productId_status_sortOrder_idx`(`productId`, `status`, `sortOrder`),
    INDEX `product_variants_activeRecipeVersionId_idx`(`activeRecipeVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recipe_versions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `variantId` BIGINT NOT NULL,
    `versionNo` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `effectiveAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdByStaffId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `archivedAt` DATETIME(3) NULL,

    INDEX `recipe_versions_variantId_status_effectiveAt_idx`(`variantId`, `status`, `effectiveAt`),
    UNIQUE INDEX `recipe_versions_variantId_versionNo_key`(`variantId`, `versionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variant_recipes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `recipeVersionId` BIGINT NOT NULL,
    `materialId` BIGINT NOT NULL,
    `role` ENUM('BASE', 'TAKEAWAY_EXTRA') NOT NULL DEFAULT 'BASE',
    `quantity` DECIMAL(18, 3) NOT NULL,

    INDEX `variant_recipes_materialId_idx`(`materialId`),
    UNIQUE INDEX `variant_recipes_recipeVersionId_materialId_role_key`(`recipeVersionId`, `materialId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variant_option_groups` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `variantId` BIGINT NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `selectionType` ENUM('SINGLE', 'MULTI') NOT NULL DEFAULT 'SINGLE',
    `required` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',

    INDEX `variant_option_groups_variantId_sortOrder_idx`(`variantId`, `sortOrder`),
    UNIQUE INDEX `variant_option_groups_variantId_code_key`(`variantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variant_option_values` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `optionGroupId` BIGINT NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `priceDeltaFen` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',

    INDEX `variant_option_values_optionGroupId_sortOrder_idx`(`optionGroupId`, `sortOrder`),
    UNIQUE INDEX `variant_option_values_optionGroupId_code_key`(`optionGroupId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recipe_modifiers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `recipeVersionId` BIGINT NOT NULL,
    `optionValueId` BIGINT NOT NULL,
    `materialId` BIGINT NOT NULL,
    `targetRole` ENUM('BASE', 'TAKEAWAY_EXTRA') NOT NULL DEFAULT 'BASE',
    `quantityDelta` DECIMAL(18, 3) NOT NULL,

    INDEX `recipe_modifiers_materialId_idx`(`materialId`),
    UNIQUE INDEX `recipe_modifiers_recipeVersionId_optionValueId_materialId_ta_key`(`recipeVersionId`, `optionValueId`, `materialId`, `targetRole`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `materials` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `storeId` BIGINT NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `unit` VARCHAR(20) NOT NULL,
    `onHand` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `reserved` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `warningThreshold` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `purchasePricePerUnit` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `materials_storeId_status_deletedAt_idx`(`storeId`, `status`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `movementNo` VARCHAR(64) NOT NULL,
    `dedupeKey` VARCHAR(160) NOT NULL,
    `storeId` BIGINT NOT NULL,
    `materialId` BIGINT NOT NULL,
    `movementType` ENUM('RESERVE', 'RELEASE', 'CONSUME', 'STOCK_IN', 'ADJUST') NOT NULL,
    `quantityDelta` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `reservedDelta` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `onHandAfter` DECIMAL(18, 3) NOT NULL,
    `reservedAfter` DECIMAL(18, 3) NOT NULL,
    `unitCostSnapshot` DECIMAL(18, 6) NULL,
    `totalCostSnapshot` DECIMAL(18, 6) NULL,
    `orderId` BIGINT NULL,
    `orderItemId` BIGINT NULL,
    `operatorStaffId` BIGINT NULL,
    `reason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stock_movements_movementNo_key`(`movementNo`),
    UNIQUE INDEX `stock_movements_dedupeKey_key`(`dedupeKey`),
    INDEX `stock_movements_storeId_movementType_createdAt_idx`(`storeId`, `movementType`, `createdAt`),
    INDEX `stock_movements_materialId_createdAt_idx`(`materialId`, `createdAt`),
    INDEX `stock_movements_orderId_materialId_movementType_idx`(`orderId`, `materialId`, `movementType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loss_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `lossNo` VARCHAR(64) NOT NULL,
    `dedupeKey` VARCHAR(160) NOT NULL,
    `storeId` BIGINT NOT NULL,
    `materialId` BIGINT NOT NULL,
    `orderId` BIGINT NULL,
    `orderItemId` BIGINT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `unitCostSnapshot` DECIMAL(18, 6) NOT NULL,
    `lossCostSnapshot` DECIMAL(18, 6) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `operatorStaffId` BIGINT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `loss_records_lossNo_key`(`lossNo`),
    UNIQUE INDEX `loss_records_dedupeKey_key`(`dedupeKey`),
    INDEX `loss_records_storeId_occurredAt_idx`(`storeId`, `occurredAt`),
    INDEX `loss_records_materialId_occurredAt_idx`(`materialId`, `occurredAt`),
    INDEX `loss_records_orderId_idx`(`orderId`),
    UNIQUE INDEX `loss_records_orderItemId_materialId_key`(`orderItemId`, `materialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dining_tables` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `storeId` BIGINT NOT NULL,
    `name` VARCHAR(40) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `activeSessionId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `dining_tables_activeSessionId_key`(`activeSessionId`),
    INDEX `dining_tables_storeId_deletedAt_idx`(`storeId`, `deletedAt`),
    UNIQUE INDEX `dining_tables_storeId_code_key`(`storeId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dining_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `storeId` BIGINT NOT NULL,
    `tableId` BIGINT NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `discountFen` INTEGER NOT NULL DEFAULT 0,
    `discountVersion` INTEGER NOT NULL DEFAULT 0,
    `allocationFinalizedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `closedByStaffId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `dining_sessions_storeId_status_openedAt_idx`(`storeId`, `status`, `openedAt`),
    INDEX `dining_sessions_tableId_status_openedAt_idx`(`tableId`, `status`, `openedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `storeId` BIGINT NOT NULL,
    `customerUserId` BIGINT NOT NULL,
    `orderNo` VARCHAR(40) NOT NULL,
    `channel` ENUM('DINE', 'TAKEAWAY') NOT NULL,
    `tableId` BIGINT NULL,
    `sessionId` BIGINT NULL,
    `status` ENUM('PENDING_ACCEPTANCE', 'ACCEPTED', 'PREPARING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    `subtotalFen` INTEGER NOT NULL,
    `discountFen` INTEGER NOT NULL DEFAULT 0,
    `totalAmountFen` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedAt` DATETIME(3) NULL,
    `preparingAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` VARCHAR(500) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_orderNo_key`(`orderNo`),
    INDEX `orders_storeId_status_createdAt_idx`(`storeId`, `status`, `createdAt`),
    INDEX `orders_sessionId_status_idx`(`sessionId`, `status`),
    INDEX `orders_customerUserId_createdAt_idx`(`customerUserId`, `createdAt`),
    INDEX `orders_completedAt_idx`(`completedAt`),
    INDEX `orders_tableId_createdAt_idx`(`tableId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orderId` BIGINT NOT NULL,
    `productId` BIGINT NOT NULL,
    `variantId` BIGINT NOT NULL,
    `recipeVersionId` BIGINT NULL,
    `productNameSnapshot` VARCHAR(120) NOT NULL,
    `variantNameSnapshot` VARCHAR(80) NOT NULL,
    `unitPriceFen` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `lineSubtotalFen` INTEGER NOT NULL,
    `strengthSnapshot` VARCHAR(40) NULL,
    `brewingMethodSnapshot` VARCHAR(80) NULL,
    `remark` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_items_orderId_idx`(`orderId`),
    INDEX `order_items_productId_createdAt_idx`(`productId`, `createdAt`),
    INDEX `order_items_variantId_createdAt_idx`(`variantId`, `createdAt`),
    INDEX `order_items_recipeVersionId_idx`(`recipeVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_options` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orderItemId` BIGINT NOT NULL,
    `optionValueId` BIGINT NOT NULL,
    `groupCodeSnapshot` VARCHAR(40) NOT NULL,
    `groupNameSnapshot` VARCHAR(80) NOT NULL,
    `valueCodeSnapshot` VARCHAR(40) NOT NULL,
    `valueNameSnapshot` VARCHAR(80) NOT NULL,
    `priceDeltaFenSnapshot` INTEGER NOT NULL DEFAULT 0,

    INDEX `order_item_options_optionValueId_idx`(`optionValueId`),
    UNIQUE INDEX `order_item_options_orderItemId_groupCodeSnapshot_valueCodeSn_key`(`orderItemId`, `groupCodeSnapshot`, `valueCodeSnapshot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_materials` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orderItemId` BIGINT NOT NULL,
    `materialId` BIGINT NOT NULL,
    `materialNameSnapshot` VARCHAR(120) NOT NULL,
    `unitSnapshot` VARCHAR(20) NOT NULL,
    `quantityPerItem` DECIMAL(18, 3) NOT NULL,
    `totalQuantity` DECIMAL(18, 3) NOT NULL,
    `unitCostSnapshot` DECIMAL(18, 6) NOT NULL,
    `totalCostSnapshot` DECIMAL(18, 6) NOT NULL,
    `source` ENUM('BASE', 'TAKEAWAY_EXTRA', 'MODIFIER') NOT NULL,

    INDEX `order_item_materials_materialId_idx`(`materialId`),
    UNIQUE INDEX `order_item_materials_orderItemId_materialId_source_key`(`orderItemId`, `materialId`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `paymentNo` VARCHAR(64) NOT NULL,
    `storeId` BIGINT NOT NULL,
    `sessionId` BIGINT NULL,
    `orderId` BIGINT NULL,
    `amountFen` INTEGER NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `operatorStaffId` BIGINT NULL,
    `status` ENUM('ACTIVE', 'VOIDED') NOT NULL DEFAULT 'ACTIVE',
    `remark` VARCHAR(500) NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedByStaffId` BIGINT NULL,
    `voidReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_records_paymentNo_key`(`paymentNo`),
    INDEX `payment_records_storeId_status_receivedAt_idx`(`storeId`, `status`, `receivedAt`),
    INDEX `payment_records_sessionId_status_idx`(`sessionId`, `status`),
    INDEX `payment_records_orderId_status_idx`(`orderId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refund_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `refundNo` VARCHAR(64) NOT NULL,
    `paymentRecordId` BIGINT NOT NULL,
    `amountFen` INTEGER NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` ENUM('ACTIVE', 'VOIDED') NOT NULL DEFAULT 'ACTIVE',
    `refundedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `operatorStaffId` BIGINT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedByStaffId` BIGINT NULL,
    `voidReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refund_records_refundNo_key`(`refundNo`),
    INDEX `refund_records_paymentRecordId_status_refundedAt_idx`(`paymentRecordId`, `status`, `refundedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discount_allocations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sessionId` BIGINT NOT NULL,
    `orderItemId` BIGINT NOT NULL,
    `allocationVersion` INTEGER NOT NULL,
    `basisAmountFen` INTEGER NOT NULL,
    `discountFen` INTEGER NOT NULL,
    `remainderRank` INTEGER NOT NULL DEFAULT 0,
    `isFinal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `discount_allocations_sessionId_allocationVersion_idx`(`sessionId`, `allocationVersion`),
    UNIQUE INDEX `discount_allocations_sessionId_orderItemId_key`(`sessionId`, `orderItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `storeId` BIGINT NOT NULL,
    `idempotencyKey` VARCHAR(160) NOT NULL,
    `endpoint` VARCHAR(255) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `status` ENUM('PROCESSING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'PROCESSING',
    `responseCode` INTEGER NULL,
    `responseBody` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `idempotency_records_status_expiresAt_idx`(`status`, `expiresAt`),
    UNIQUE INDEX `idempotency_records_storeId_endpoint_idempotencyKey_key`(`storeId`, `endpoint`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `storeId` BIGINT NOT NULL,
    `actorType` ENUM('CUSTOMER', 'STAFF', 'SYSTEM') NOT NULL,
    `actorUserId` BIGINT NULL,
    `actorStaffId` BIGINT NULL,
    `action` VARCHAR(80) NOT NULL,
    `targetType` VARCHAR(80) NOT NULL,
    `targetId` VARCHAR(80) NOT NULL,
    `beforeData` JSON NULL,
    `afterData` JSON NULL,
    `reason` VARCHAR(500) NULL,
    `requestId` VARCHAR(80) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_storeId_createdAt_idx`(`storeId`, `createdAt`),
    INDEX `audit_logs_targetType_targetId_createdAt_idx`(`targetType`, `targetId`, `createdAt`),
    INDEX `audit_logs_actorStaffId_createdAt_idx`(`actorStaffId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stores` ADD CONSTRAINT `stores_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_order_policies` ADD CONSTRAINT `store_order_policies_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_activeRecipeVersionId_fkey` FOREIGN KEY (`activeRecipeVersionId`) REFERENCES `recipe_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_versions` ADD CONSTRAINT `recipe_versions_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_versions` ADD CONSTRAINT `recipe_versions_createdByStaffId_fkey` FOREIGN KEY (`createdByStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_recipes` ADD CONSTRAINT `variant_recipes_recipeVersionId_fkey` FOREIGN KEY (`recipeVersionId`) REFERENCES `recipe_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_recipes` ADD CONSTRAINT `variant_recipes_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_option_groups` ADD CONSTRAINT `variant_option_groups_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_option_values` ADD CONSTRAINT `variant_option_values_optionGroupId_fkey` FOREIGN KEY (`optionGroupId`) REFERENCES `variant_option_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_modifiers` ADD CONSTRAINT `recipe_modifiers_recipeVersionId_fkey` FOREIGN KEY (`recipeVersionId`) REFERENCES `recipe_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_modifiers` ADD CONSTRAINT `recipe_modifiers_optionValueId_fkey` FOREIGN KEY (`optionValueId`) REFERENCES `variant_option_values`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_modifiers` ADD CONSTRAINT `recipe_modifiers_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `materials_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_operatorStaffId_fkey` FOREIGN KEY (`operatorStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_operatorStaffId_fkey` FOREIGN KEY (`operatorStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_tables` ADD CONSTRAINT `dining_tables_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_tables` ADD CONSTRAINT `dining_tables_activeSessionId_fkey` FOREIGN KEY (`activeSessionId`) REFERENCES `dining_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_sessions` ADD CONSTRAINT `dining_sessions_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_sessions` ADD CONSTRAINT `dining_sessions_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `dining_tables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_sessions` ADD CONSTRAINT `dining_sessions_closedByStaffId_fkey` FOREIGN KEY (`closedByStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customerUserId_fkey` FOREIGN KEY (`customerUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `dining_tables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `dining_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_recipeVersionId_fkey` FOREIGN KEY (`recipeVersionId`) REFERENCES `recipe_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_options` ADD CONSTRAINT `order_item_options_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_options` ADD CONSTRAINT `order_item_options_optionValueId_fkey` FOREIGN KEY (`optionValueId`) REFERENCES `variant_option_values`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_materials` ADD CONSTRAINT `order_item_materials_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_materials` ADD CONSTRAINT `order_item_materials_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `dining_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_operatorStaffId_fkey` FOREIGN KEY (`operatorStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_voidedByStaffId_fkey` FOREIGN KEY (`voidedByStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund_records` ADD CONSTRAINT `refund_records_paymentRecordId_fkey` FOREIGN KEY (`paymentRecordId`) REFERENCES `payment_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund_records` ADD CONSTRAINT `refund_records_operatorStaffId_fkey` FOREIGN KEY (`operatorStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund_records` ADD CONSTRAINT `refund_records_voidedByStaffId_fkey` FOREIGN KEY (`voidedByStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discount_allocations` ADD CONSTRAINT `discount_allocations_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `dining_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discount_allocations` ADD CONSTRAINT `discount_allocations_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idempotency_records` ADD CONSTRAINT `idempotency_records_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorStaffId_fkey` FOREIGN KEY (`actorStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
