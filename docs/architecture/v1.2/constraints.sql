-- 山隐茶事 V1.2 supplemental MySQL constraints
-- Apply after `prisma migrate diff` / `prisma migrate deploy`.
-- Prisma cannot express every cross-table or append-only invariant.
-- Aggregate money invariants still require the locked transaction algorithms in transactions.md.

-- 1. Basic value constraints
ALTER TABLE `stores`
  ADD CONSTRAINT `chk_store_cutoff` CHECK (`businessDayCutoffMinute` BETWEEN 0 AND 1439);

ALTER TABLE `store_order_policies`
  ADD CONSTRAINT `chk_policy_limits` CHECK (
    `pendingReminderMinutes` > 0 AND
    `maxPendingOrdersPerCustomer` > 0 AND
    `maxPendingOrdersPerSession` > 0
  );

ALTER TABLE `product_variants`
  ADD CONSTRAINT `chk_variant_price` CHECK (`priceFen` >= 0);

ALTER TABLE `recipe_versions`
  ADD CONSTRAINT `chk_recipe_version_no` CHECK (`versionNo` > 0);

ALTER TABLE `variant_recipes`
  ADD CONSTRAINT `chk_variant_recipe_qty` CHECK (`quantity` > 0);

ALTER TABLE `recipe_modifiers`
  ADD CONSTRAINT `chk_modifier_nonzero` CHECK (`quantityDelta` <> 0);

ALTER TABLE `materials`
  ADD CONSTRAINT `chk_material_nonnegative` CHECK (
    `onHand` >= 0 AND `reserved` >= 0 AND
    `warningThreshold` >= 0 AND `purchasePricePerUnit` >= 0
  ),
  ADD CONSTRAINT `chk_material_reserved_le_onhand` CHECK (`reserved` <= `onHand`);

ALTER TABLE `stock_movements`
  ADD CONSTRAINT `chk_stock_movement_nonnegative_after` CHECK (
    `onHandAfter` >= 0 AND `reservedAfter` >= 0 AND `reservedAfter` <= `onHandAfter`
  ),
  ADD CONSTRAINT `chk_stock_movement_semantics` CHECK (
    (`movementType` = 'RESERVE' AND `quantityDelta` = 0 AND `reservedDelta` > 0) OR
    (`movementType` = 'RELEASE' AND `quantityDelta` = 0 AND `reservedDelta` < 0) OR
    (`movementType` = 'CONSUME' AND `quantityDelta` < 0 AND `reservedDelta` < 0 AND `quantityDelta` = `reservedDelta`) OR
    (`movementType` = 'STOCK_IN' AND `quantityDelta` > 0 AND `reservedDelta` = 0) OR
    (`movementType` = 'ADJUST' AND `quantityDelta` <> 0 AND `reservedDelta` = 0)
  );

ALTER TABLE `loss_records`
  ADD CONSTRAINT `chk_loss_values` CHECK (`quantity` > 0 AND `unitCostSnapshot` >= 0 AND `lossCostSnapshot` >= 0),
  ADD CONSTRAINT `chk_loss_order_pair` CHECK (
    (`orderId` IS NULL AND `orderItemId` IS NULL) OR
    (`orderId` IS NOT NULL AND `orderItemId` IS NOT NULL)
  );

ALTER TABLE `dining_tables`
  ADD CONSTRAINT `chk_table_capacity` CHECK (`capacity` > 0);

ALTER TABLE `dining_sessions`
  ADD CONSTRAINT `chk_session_discount` CHECK (`discountFen` >= 0),
  ADD CONSTRAINT `chk_session_versions` CHECK (`discountVersion` >= 0 AND `version` > 0);

ALTER TABLE `orders`
  ADD CONSTRAINT `chk_order_amounts` CHECK (
    `subtotalFen` >= 0 AND `discountFen` >= 0 AND
    `totalAmountFen` = `subtotalFen` - `discountFen` AND
    `totalAmountFen` >= 0
  ),
  ADD CONSTRAINT `chk_order_target` CHECK (
    (`channel` = 'DINE' AND `tableId` IS NOT NULL AND `sessionId` IS NOT NULL) OR
    (`channel` = 'TAKEAWAY' AND `tableId` IS NULL AND `sessionId` IS NULL)
  ),
  ADD CONSTRAINT `chk_order_version` CHECK (`version` > 0);

ALTER TABLE `order_items`
  ADD CONSTRAINT `chk_order_item_amounts` CHECK (
    `unitPriceFen` >= 0 AND `quantity` > 0 AND
    `lineSubtotalFen` = `unitPriceFen` * `quantity`
  );

ALTER TABLE `order_item_materials`
  ADD CONSTRAINT `chk_order_item_material_amounts` CHECK (
    `quantityPerItem` > 0 AND `totalQuantity` > 0 AND
    `unitCostSnapshot` >= 0 AND `totalCostSnapshot` >= 0
  );

ALTER TABLE `payment_records`
  ADD CONSTRAINT `chk_payment_amount` CHECK (`amountFen` > 0),
  ADD CONSTRAINT `chk_payment_target_xor` CHECK (
    (`sessionId` IS NOT NULL AND `orderId` IS NULL) OR
    (`sessionId` IS NULL AND `orderId` IS NOT NULL)
  ),
  ADD CONSTRAINT `chk_payment_void_state` CHECK (
    (`status` = 'ACTIVE' AND `voidedAt` IS NULL AND `voidedByStaffId` IS NULL) OR
    (`status` = 'VOIDED' AND `voidedAt` IS NOT NULL AND `voidedByStaffId` IS NOT NULL AND `voidReason` IS NOT NULL)
  );

ALTER TABLE `refund_records`
  ADD CONSTRAINT `chk_refund_amount` CHECK (`amountFen` > 0),
  ADD CONSTRAINT `chk_refund_void_state` CHECK (
    (`status` = 'ACTIVE' AND `voidedAt` IS NULL AND `voidedByStaffId` IS NULL) OR
    (`status` = 'VOIDED' AND `voidedAt` IS NOT NULL AND `voidedByStaffId` IS NOT NULL AND `voidReason` IS NOT NULL)
  );

ALTER TABLE `discount_allocations`
  ADD CONSTRAINT `chk_discount_allocation_amounts` CHECK (
    `basisAmountFen` >= 0 AND `discountFen` >= 0 AND `discountFen` <= `basisAmountFen`
  );

-- 2. One OPEN DiningSession per table
ALTER TABLE `dining_sessions`
  ADD COLUMN `open_table_guard` BIGINT
    GENERATED ALWAYS AS (CASE WHEN `status` = 'OPEN' THEN `tableId` ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_one_open_session_per_table` (`open_table_guard`);

-- 3. At most one ACTIVE RecipeVersion per variant
ALTER TABLE `recipe_versions`
  ADD COLUMN `active_variant_guard` BIGINT
    GENERATED ALWAYS AS (CASE WHEN `status` = 'ACTIVE' THEN `variantId` ELSE NULL END) STORED,
  ADD UNIQUE KEY `uq_one_active_recipe_per_variant` (`active_variant_guard`);

-- 4. DiningTable.activeSessionId must point to an OPEN session of the same table
DELIMITER $$
CREATE TRIGGER `trg_dining_table_active_session_bi`
BEFORE INSERT ON `dining_tables`
FOR EACH ROW
BEGIN
  IF NEW.`activeSessionId` IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM `dining_sessions`
      WHERE `id` = NEW.`activeSessionId`
        AND `tableId` = NEW.`id`
        AND `status` = 'OPEN'
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'activeSessionId must reference an OPEN session of this table';
    END IF;
  END IF;
END$$

CREATE TRIGGER `trg_dining_table_active_session_bu`
BEFORE UPDATE ON `dining_tables`
FOR EACH ROW
BEGIN
  IF NEW.`activeSessionId` IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM `dining_sessions`
      WHERE `id` = NEW.`activeSessionId`
        AND `tableId` = NEW.`id`
        AND `status` = 'OPEN'
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'activeSessionId must reference an OPEN session of this table';
    END IF;
  END IF;
END$$

-- 5. ProductVariant.activeRecipeVersionId must belong to the same variant and be ACTIVE
CREATE TRIGGER `trg_variant_active_recipe_bi`
BEFORE INSERT ON `product_variants`
FOR EACH ROW
BEGIN
  IF NEW.`activeRecipeVersionId` IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM `recipe_versions`
      WHERE `id` = NEW.`activeRecipeVersionId`
        AND `variantId` = NEW.`id`
        AND `status` = 'ACTIVE'
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'activeRecipeVersionId must be an ACTIVE recipe of this variant';
    END IF;
  END IF;
END$$

CREATE TRIGGER `trg_variant_active_recipe_bu`
BEFORE UPDATE ON `product_variants`
FOR EACH ROW
BEGIN
  IF NEW.`activeRecipeVersionId` IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM `recipe_versions`
      WHERE `id` = NEW.`activeRecipeVersionId`
        AND `variantId` = NEW.`id`
        AND `status` = 'ACTIVE'
    ) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'activeRecipeVersionId must be an ACTIVE recipe of this variant';
    END IF;
  END IF;
END$$

-- 6. Recipe child rows are editable only while the recipe version is DRAFT
CREATE TRIGGER `trg_variant_recipe_immutable_bu`
BEFORE UPDATE ON `variant_recipes`
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM `recipe_versions`
    WHERE `id` = OLD.`recipeVersionId` AND `status` = 'DRAFT'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ACTIVE/ARCHIVED recipe rows are immutable';
  END IF;
END$$

CREATE TRIGGER `trg_variant_recipe_immutable_bd`
BEFORE DELETE ON `variant_recipes`
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM `recipe_versions`
    WHERE `id` = OLD.`recipeVersionId` AND `status` = 'DRAFT'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ACTIVE/ARCHIVED recipe rows are immutable';
  END IF;
END$$

CREATE TRIGGER `trg_recipe_modifier_immutable_bu`
BEFORE UPDATE ON `recipe_modifiers`
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM `recipe_versions`
    WHERE `id` = OLD.`recipeVersionId` AND `status` = 'DRAFT'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ACTIVE/ARCHIVED recipe modifiers are immutable';
  END IF;
END$$

CREATE TRIGGER `trg_recipe_modifier_immutable_bd`
BEFORE DELETE ON `recipe_modifiers`
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM `recipe_versions`
    WHERE `id` = OLD.`recipeVersionId` AND `status` = 'DRAFT'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ACTIVE/ARCHIVED recipe modifiers are immutable';
  END IF;
END$$

DELIMITER ;

-- 7. Snapshot and accounting fact tables are append-only
CREATE TRIGGER `trg_order_item_snapshot_no_update` BEFORE UPDATE ON `order_items`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order item snapshots are immutable';
CREATE TRIGGER `trg_order_item_snapshot_no_delete` BEFORE DELETE ON `order_items`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order item snapshots cannot be deleted';
CREATE TRIGGER `trg_order_option_snapshot_no_update` BEFORE UPDATE ON `order_item_options`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order option snapshots are immutable';
CREATE TRIGGER `trg_order_option_snapshot_no_delete` BEFORE DELETE ON `order_item_options`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order option snapshots cannot be deleted';
CREATE TRIGGER `trg_order_material_snapshot_no_update` BEFORE UPDATE ON `order_item_materials`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order material snapshots are immutable';
CREATE TRIGGER `trg_order_material_snapshot_no_delete` BEFORE DELETE ON `order_item_materials`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order material snapshots cannot be deleted';
CREATE TRIGGER `trg_stock_movement_no_update` BEFORE UPDATE ON `stock_movements`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock movements are append-only';
CREATE TRIGGER `trg_stock_movement_no_delete` BEFORE DELETE ON `stock_movements`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock movements cannot be deleted';
CREATE TRIGGER `trg_loss_record_no_update` BEFORE UPDATE ON `loss_records`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Loss records are append-only';
CREATE TRIGGER `trg_loss_record_no_delete` BEFORE DELETE ON `loss_records`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Loss records cannot be deleted';
CREATE TRIGGER `trg_audit_log_no_update` BEFORE UPDATE ON `audit_logs`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs are append-only';
CREATE TRIGGER `trg_audit_log_no_delete` BEFORE DELETE ON `audit_logs`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs cannot be deleted';
DELIMITER ;

-- 8. Order immutable fields and no delete
DELIMITER $$
CREATE TRIGGER `trg_order_immutable_fields_bu`
BEFORE UPDATE ON `orders`
FOR EACH ROW
BEGIN
  IF OLD.`storeId` <> NEW.`storeId`
     OR OLD.`customerUserId` <> NEW.`customerUserId`
     OR OLD.`orderNo` <> NEW.`orderNo`
     OR OLD.`channel` <> NEW.`channel`
     OR NOT (OLD.`tableId` <=> NEW.`tableId`)
     OR NOT (OLD.`sessionId` <=> NEW.`sessionId`)
     OR OLD.`subtotalFen` <> NEW.`subtotalFen` THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Immutable order fields cannot be changed';
  END IF;
END$$
CREATE TRIGGER `trg_order_no_delete` BEFORE DELETE ON `orders`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Orders cannot be deleted';
DELIMITER ;

-- 9. Payment / refund append-only with controlled void transition
DELIMITER $$
CREATE TRIGGER `trg_payment_record_controlled_bu`
BEFORE UPDATE ON `payment_records`
FOR EACH ROW
BEGIN
  IF OLD.`amountFen` <> NEW.`amountFen`
     OR OLD.`storeId` <> NEW.`storeId`
     OR NOT (OLD.`sessionId` <=> NEW.`sessionId`)
     OR NOT (OLD.`orderId` <=> NEW.`orderId`)
     OR OLD.`receivedAt` <> NEW.`receivedAt`
     OR NOT (OLD.`operatorStaffId` <=> NEW.`operatorStaffId`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment financial fields are immutable';
  END IF;
  IF OLD.`status` = 'VOIDED' AND NEW.`status` <> 'VOIDED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Voided payment cannot be reactivated';
  END IF;
END$$
CREATE TRIGGER `trg_payment_record_no_delete` BEFORE DELETE ON `payment_records`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment records cannot be deleted';

CREATE TRIGGER `trg_refund_record_limit_bi`
BEFORE INSERT ON `refund_records`
FOR EACH ROW
BEGIN
  DECLARE payment_amount INT DEFAULT 0;
  DECLARE active_refunds INT DEFAULT 0;

  SELECT `amountFen` INTO payment_amount
  FROM `payment_records`
  WHERE `id` = NEW.`paymentRecordId` AND `status` = 'ACTIVE';

  IF payment_amount IS NULL OR payment_amount = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refund must reference an ACTIVE payment';
  END IF;

  SELECT COALESCE(SUM(`amountFen`),0) INTO active_refunds
  FROM `refund_records`
  WHERE `paymentRecordId` = NEW.`paymentRecordId` AND `status` = 'ACTIVE';

  IF active_refunds + NEW.`amountFen` > payment_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active refunds cannot exceed the original payment';
  END IF;
END$$

CREATE TRIGGER `trg_refund_record_controlled_bu`
BEFORE UPDATE ON `refund_records`
FOR EACH ROW
BEGIN
  IF OLD.`amountFen` <> NEW.`amountFen`
     OR OLD.`paymentRecordId` <> NEW.`paymentRecordId`
     OR OLD.`refundedAt` <> NEW.`refundedAt`
     OR NOT (OLD.`operatorStaffId` <=> NEW.`operatorStaffId`) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refund financial fields are immutable';
  END IF;
  IF OLD.`status` = 'VOIDED' AND NEW.`status` <> 'VOIDED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Voided refund cannot be reactivated';
  END IF;
END$$
CREATE TRIGGER `trg_refund_record_no_delete` BEFORE DELETE ON `refund_records`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Refund records cannot be deleted';
DELIMITER ;

-- 10. Discount allocation rows remain as history; final rows are immutable
DELIMITER $$
CREATE TRIGGER `trg_discount_allocation_final_bu`
BEFORE UPDATE ON `discount_allocations`
FOR EACH ROW
BEGIN
  IF OLD.`isFinal` = 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Final discount allocations are immutable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM `dining_sessions`
    WHERE `id` = OLD.`sessionId` AND `status` = 'CLOSED'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Closed session allocations cannot be changed';
  END IF;
END$$
CREATE TRIGGER `trg_discount_allocation_no_delete` BEFORE DELETE ON `discount_allocations`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Discount allocations cannot be deleted';
DELIMITER ;

