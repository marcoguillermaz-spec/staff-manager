-- Migration 003: add must_change_password flag to user_profiles
alter table user_profiles
  add column must_change_password boolean not null default false;
