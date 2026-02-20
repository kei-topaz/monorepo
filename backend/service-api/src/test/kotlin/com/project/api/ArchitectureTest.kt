

package com.project.api

import com.tngtech.archunit.core.importer.ImportOption
import com.tngtech.archunit.junit.AnalyzeClasses
import com.tngtech.archunit.junit.ArchTest
import com.tngtech.archunit.lang.ArchRule
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses

@AnalyzeClasses(packages = ["com.project"], importOptions = [ImportOption.DoNotIncludeTests::class])
class ArchitectureTest {
    // @ArchTest
    val domainCoreShouldNotDependOnInfrastructure: ArchRule =
        noClasses()
            .that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAPackage("..infrastructure..")
            .because("Domain logic should be pure and independent of infrastructure details.")

    // @ArchTest
    val domainCoreShouldNotDependOnServiceApi: ArchRule =
        noClasses()
            .that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAPackage("..api..")
            .because("Domain layer is the innermost layer and should not know about the API layer.")

    // @ArchTest
    val handlersShouldHaveHandlerSuffix: ArchRule =
        classes()
            .that().resideInAPackage("..handlers..")
            .and().haveSimpleNameNotEndingWith("Request")
            .and().haveSimpleNameNotEndingWith("Response")
            .should().haveSimpleNameEndingWith("Handler")
            .because("Handlers should follow naming convention for clarity.")
}
