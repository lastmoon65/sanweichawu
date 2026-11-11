INSERT INTO merchants (id,name,status,createdAt,updatedAt) VALUES (1,'测试商户','ACTIVE',NOW(3),NOW(3));
INSERT INTO stores (id,merchantId,name,status,timezone,businessDayCutoffMinute,createdAt,updatedAt) VALUES
  (1,1,'A店','ACTIVE','Asia/Shanghai',0,NOW(3),NOW(3)),
  (2,1,'B店','ACTIVE','Asia/Shanghai',0,NOW(3),NOW(3));
INSERT INTO users (id,openid,status,createdAt,updatedAt) VALUES (1,'test-openid','ACTIVE',NOW(3),NOW(3));
INSERT INTO categories (id,storeId,name,sortOrder,status,createdAt,updatedAt) VALUES
  (1,1,'A茶类',0,'ACTIVE',NOW(3),NOW(3)),
  (2,2,'B茶类',0,'ACTIVE',NOW(3),NOW(3));
INSERT INTO products (id,storeId,categoryId,name,status,sortOrder,createdAt,updatedAt) VALUES
  (1,1,1,'测试茶','ACTIVE',0,NOW(3),NOW(3)),
  (2,1,1,'测试茶二代','ACTIVE',1,NOW(3),NOW(3));
INSERT INTO materials (id,storeId,name,unit,onHand,reserved,warningThreshold,purchasePricePerUnit,status,version,createdAt,updatedAt) VALUES
  (1,1,'茶叶A','克',100,0,10,0.3,'ACTIVE',1,NOW(3),NOW(3)),
  (2,1,'茶叶B','克',100,0,10,0.2,'ACTIVE',1,NOW(3),NOW(3)),
  (3,2,'B店茶叶','克',100,0,10,0.2,'ACTIVE',1,NOW(3),NOW(3));
INSERT INTO product_variants (id,productId,name,priceFen,inventoryMode,status,sortOrder,createdAt,updatedAt) VALUES
  (1,1,'单杯',1000,'MANAGED','ACTIVE',0,NOW(3),NOW(3)),
  (2,1,'双杯',1800,'MANAGED','ACTIVE',1,NOW(3),NOW(3));
INSERT INTO recipe_versions (id,variantId,versionNo,status,effectiveAt,createdAt) VALUES
  (1,1,1,'DRAFT',NOW(3),NOW(3)),
  (2,2,1,'DRAFT',NOW(3),NOW(3));
INSERT INTO variant_recipes (recipeVersionId,materialId,role,quantity) VALUES (1,1,'BASE',8.0);
INSERT INTO variant_option_groups (id,variantId,code,name,selectionType,required,sortOrder,status) VALUES
  (1,1,'STRENGTH','浓淡','SINGLE',1,0,'ACTIVE');
INSERT INTO variant_option_values (id,optionGroupId,code,name,priceDeltaFen,sortOrder,status) VALUES
  (1,1,'STRONG','浓郁',0,0,'ACTIVE');
UPDATE recipe_versions SET status='ACTIVE' WHERE id IN (1,2);
UPDATE product_variants SET activeRecipeVersionId=1 WHERE id=1;
UPDATE product_variants SET activeRecipeVersionId=2 WHERE id=2;
INSERT INTO orders (id,storeId,customerUserId,orderNo,channel,status,subtotalFen,discountFen,totalAmountFen,version,createdAt,updatedAt) VALUES
  (1,1,1,'TEST-ORDER-1','TAKEAWAY','PENDING_ACCEPTANCE',1000,0,1000,1,NOW(3),NOW(3));
