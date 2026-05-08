do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when undefined_function then null;
end $$;
