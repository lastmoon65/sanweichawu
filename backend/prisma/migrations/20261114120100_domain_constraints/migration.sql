-- P1-02 domain CHECK constraints
-- MySQL 8.4 LTS
-- No generated columns and no triggers are introduced.
-- Cross-table checks (for example LossRecord vs StockMovement material/quantity/cost)
-- remain service transaction responsibilities and require integration tests.

-- Store configuration
ALTER TABLE `stores`
  ADD CONSTRAINT `chk_stores_business_day_cutoff_minute`
  CHECK (`business_day_cutoff_minute` BETWEEN 0 AND 1439);

-- Catalog and version bounds

ALTER TABLE `product_variants`
  ADD CONSTRAINT `chk_product_variants_price_fen_nonnegative`
  CHECK (`price_fen` >= 0);

ALTER TABLE `variant_recipes`
  ADD CONSTRAINT `chk_variant_recipes_quantity_positive`
  CHECK (`quantity` > 0);

ALTER TABLE `materials`
  ADD CONSTRAINT `chk_materials_nonnegative_balances`
  CHECK (
    `on_hand` >= 0
    AND `reserved` >= 0
    AND `average_cost_per_unit` >= 0
    AND `reserved` <= `on_hand`
  );

ALTER TABLE `materials`
  ADD CONSTRAINT `chk_materials_version_positive`
  CHECK (`version` > 0);

ALTER TABLE `stock_movements`
  ADD CONSTRAINT `chk_stock_movements_balance`
  CHECK (
    `on_hand_after` >= 0
    AND `reserved_after` >= 0
    AND `reserved_after` <= `on_hand_after`
  );

ALTER TABLE `stock_movements`
  ADD CONSTRAINT `chk_stock_movements_direction`
  CHECK (
    (`movement_type` = 'OPENING_BALANCE' AND `quantity_delta` >= 0 AND `reserved_delta` = 0)
    OR (`movement_type` = 'STOCK_IN' AND `quantity_delta` > 0 AND `reserved_delta` = 0)
    OR (`movement_type` = 'RESERVE' AND `quantity_delta` = 0 AND `reserved_delta` > 0)
    OR (`movement_type` = 'RELEASE' AND `quantity_delta` = 0 AND `reserved_delta` < 0)
    OR (`movement_type` = 'CONSUME' AND `quantity_delta` < 0 AND `reserved_delta` < 0 AND `quantity_delta` = `reserved_delta`)
    OR (`movement_type` = 'ADJUST' AND `quantity_delta` <> 0 AND `reserved_delta` = 0)
  );

ALTER TABLE `stock_movements`
  ADD CONSTRAINT `chk_stock_movements_cost_nonnegative`
  CHECK (
    (`unit_cost_snapshot` IS NULL OR `unit_cost_snapshot` >= 0)
    AND (`total_cost_snapshot` IS NULL OR `total_cost_snapshot` >= 0)
  );

-- Loss facts

ALTER TABLE `loss_records`
  ADD CONSTRAINT `chk_loss_records_values_nonnegative`
  CHECK (
    `quantity` > 0
    AND `unit_cost_snapshot` >= 0
    AND `loss_cost_snapshot` >= 0
  );

-- Dining lifecycle

ALTER TABLE `dining_sessions`
  ADD CONSTRAINT `chk_dining_sessions_version_positive`
  CHECK (`version` > 0);

ALTER TABLE `dining_sessions`
  ADD CONSTRAINT `chk_dining_sessions_closed_fields`
  CHECK (
    (`status` = 'OPEN' AND `closed_at` IS NULL AND `closed_by_staff_id` IS NULL)
    OR (`status` = 'CLOSED' AND `closed_at` IS NOT NULL)
  );

-- Order amounts and channel/session target

ALTER TABLE `orders`
  ADD CONSTRAINT `chk_orders_version_positive`
  CHECK (`version` > 0);

ALTER TABLE `orders`
  ADD CONSTRAINT `chk_orders_amounts`
  CHECK (
    `subtotal_fen` >= 0
    AND `total_amount_fen` >= 0
    AND `total_amount_fen` = `subtotal_fen`
  );

ALTER TABLE `orders`
  ADD CONSTRAINT `chk_orders_channel_session`
  CHECK (
    (`channel` = 'DINE' AND `session_id` IS NOT NULL)
    OR (`channel` = 'TAKEAWAY' AND `session_id` IS NULL)
  );

-- Order item arithmetic

ALTER TABLE `order_items`
  ADD CONSTRAINT `chk_order_items_values`
  CHECK (
    `quantity` > 0
    AND `unit_price_fen` >= 0
    AND `line_subtotal_fen` = `unit_price_fen` * `quantity`
  );

ALTER TABLE `order_item_materials`
  ADD CONSTRAINT `chk_order_item_materials_quantities`
  CHECK (`quantity_per_item` >= 0 AND `total_quantity` >= 0);

ALTER TABLE `order_item_materials`
  ADD CONSTRAINT `chk_order_item_materials_cost_pair`
  CHECK (
    (`actual_unit_cost_snapshot` IS NULL AND `actual_total_cost_snapshot` IS NULL)
    OR (
      `actual_unit_cost_snapshot` IS NOT NULL
      AND `actual_unit_cost_snapshot` >= 0
      AND `actual_total_cost_snapshot` IS NOT NULL
      AND `actual_total_cost_snapshot` >= 0
    )
  );

-- Payment ownership, amount and void audit

ALTER TABLE `payment_records`
  ADD CONSTRAINT `chk_payment_records_target_xor`
  CHECK ((`session_id` IS NULL) <> (`order_id` IS NULL));

ALTER TABLE `payment_records`
  ADD CONSTRAINT `chk_payment_records_amount_positive`
  CHECK (`amount_fen` > 0);

ALTER TABLE `payment_records`
  ADD CONSTRAINT `chk_payment_records_void_audit`
  CHECK (
    (`status` = 'ACTIVE' AND `voided_at` IS NULL AND `voided_by_staff_id` IS NULL AND `void_reason` IS NULL)
    OR (`status` = 'VOIDED' AND `voided_at` IS NOT NULL AND `voided_by_staff_id` IS NOT NULL AND `void_reason` IS NOT NULL)
  );

-- Refund amount and void audit

ALTER TABLE `refund_records`
  ADD CONSTRAINT `chk_refund_records_amount_positive`
  CHECK (`amount_fen` > 0);

ALTER TABLE `refund_records`
  ADD CONSTRAINT `chk_refund_records_void_audit`
  CHECK (
    (`status` = 'ACTIVE' AND `voided_at` IS NULL AND `voided_by_staff_id` IS NULL AND `void_reason` IS NULL)
    OR (`status` = 'VOIDED' AND `voided_at` IS NOT NULL AND `voided_by_staff_id` IS NOT NULL AND `void_reason` IS NOT NULL)
  );