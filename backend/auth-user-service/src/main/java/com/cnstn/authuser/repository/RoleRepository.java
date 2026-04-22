package com.cnstn.authuser.repository;

import com.cnstn.authuser.entity.RoleEntity;
import com.cnstn.authuser.entity.RoleName;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<RoleEntity, UUID> {

    Optional<RoleEntity> findByName(RoleName name);

    List<RoleEntity> findByNameIn(Collection<RoleName> names);
}
