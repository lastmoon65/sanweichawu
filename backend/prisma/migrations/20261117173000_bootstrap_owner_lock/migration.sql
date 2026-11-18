-- CreateTable
CREATE TABLE `bootstrap_locks` (
    `lock_key` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`lock_key`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the single protocol row used by first-OWNER bootstrap.
INSERT INTO `bootstrap_locks` (`lock_key`) VALUES ('first_owner_bootstrap_v1');
