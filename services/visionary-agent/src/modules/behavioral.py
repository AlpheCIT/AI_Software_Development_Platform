"""
Behavioral analysis DSPy modules for frontend, backend, and middleware layers.

Each module uses multi-step ChainOfThought reasoning to extract detailed
behavioral specifications from source code.
"""

import dspy
import json
from typing import Optional


# =============================================================================
# Signatures — Frontend
# =============================================================================

class IdentifyScreens(dspy.Signature):
    """Given a file list and route definitions, identify user-facing screen
    components (pages/views), excluding utility components, hooks, and helpers."""
    file_list: str = dspy.InputField(desc="Newline-separated list of all files in the repository")
    routes: str = dspy.InputField(desc="Route definitions or router config content (may be empty)")
    screens: str = dspy.OutputField(
        desc="JSON array of {filePath, componentName, inferredRoute, reason} for each user-facing screen"
    )


class AnalyzeComponent(dspy.Signature):
    """Read the FULL source code of a screen component and extract every
    interactive UI element with detailed behavior descriptions."""
    component_path: str = dspy.InputField(desc="File path of the component")
    component_code: str = dspy.InputField(desc="Full source code of the component (max 15000 chars)")
    route: str = dspy.InputField(desc="Page route this component renders at")
    elements: str = dspy.OutputField(
        desc="JSON array of {elementType, label, action, targetEndpoint, stateChanges, validationRules, errorHandling}"
    )
    purpose: str = dspy.OutputField(desc="One-sentence purpose of this screen")
    user_role: str = dspy.OutputField(desc="Who uses this screen (e.g. admin, end-user, anonymous)")
    state_description: str = dspy.OutputField(desc="Description of local and global state this component reads/writes")
    data_flow: str = dspy.OutputField(desc="How data enters and leaves this component (props, API calls, stores)")


class TraceUserFlows(dspy.Signature):
    """Connect interactive elements across components into end-to-end user
    flows (e.g. login → dashboard → create item → confirmation)."""
    component_specs: str = dspy.InputField(desc="JSON array of component behavioral specs already extracted")
    user_flows: str = dspy.OutputField(
        desc="JSON array of {flowName, description, steps: [{screen, action, outcome, nextScreen}]}"
    )


class VerifyBehavioralClaims(dspy.Signature):
    """Verify behavioral claims about frontend elements against actual handler
    or API code. Flag any claim that cannot be confirmed."""
    claims: str = dspy.InputField(desc="JSON array of behavioral claims (element actions, endpoints called)")
    handler_code: str = dspy.InputField(desc="Relevant backend handler or API code to verify against")
    verified_claims: str = dspy.OutputField(
        desc="JSON array of {claim, verified: bool, evidence, correction}"
    )


# =============================================================================
# Signatures — Backend
# =============================================================================

class IdentifyRouteFiles(dspy.Signature):
    """Find all API route/controller files in the repository file list."""
    file_list: str = dspy.InputField(desc="Newline-separated list of all files")
    framework_hint: str = dspy.InputField(desc="Framework name if known (Express, Fastify, Django, etc.)")
    route_files: str = dspy.OutputField(
        desc="JSON array of {filePath, framework, routePrefix} for each route/controller file"
    )


class AnalyzeEndpoint(dspy.Signature):
    """Analyze a route file and describe what each endpoint does in detail."""
    file_path: str = dspy.InputField(desc="Path to the route file")
    file_content: str = dspy.InputField(desc="Full source code of the route file (max 15000 chars)")
    framework: str = dspy.InputField(desc="Web framework used")
    endpoints: str = dspy.OutputField(
        desc=(
            "JSON array of {method, path, purpose, authRequired, validationRules, "
            "businessLogic, dbOperations, sideEffects, errorHandling, responseShape}"
        )
    )


class TraceDbOperations(dspy.Signature):
    """Trace actual database queries/operations in handler code, identifying
    the collection/table, operation type, and any joins or aggregations."""
    handler_code: str = dspy.InputField(desc="Handler/service code that performs DB operations")
    db_operations: str = dspy.OutputField(
        desc=(
            "JSON array of {endpoint, operation, collection, query, "
            "joinsOrLookups, indexUsed, riskNotes}"
        )
    )


# =============================================================================
# Signatures — Middleware
# =============================================================================

class FindMiddleware(dspy.Signature):
    """Scan server entry files and middleware directories to inventory all
    middleware used in the application."""
    entry_file_content: str = dspy.InputField(desc="Content of the server entry file (app.ts/index.ts/etc.)")
    middleware_dir_files: str = dspy.InputField(desc="JSON array of {path, content} for middleware directory files")
    middleware_list: str = dspy.OutputField(
        desc=(
            "JSON array of {name, type, source, purpose, appliedGlobally: bool, "
            "configOptions}"
        )
    )


class MapRoutesToMiddleware(dspy.Signature):
    """Map which middleware applies to which routes, including order of execution."""
    middleware_list: str = dspy.InputField(desc="JSON array of middleware inventory")
    route_files_summary: str = dspy.InputField(desc="Summary of route files and their route prefixes")
    route_middleware_map: str = dspy.OutputField(
        desc="JSON array of {route, middlewareChain: [name], notes}"
    )


class TraceAuthFlows(dspy.Signature):
    """Trace authentication flows end-to-end: credential submission, session
    creation, token generation, token validation, and refresh."""
    auth_middleware_code: str = dspy.InputField(desc="Authentication middleware source code")
    auth_route_code: str = dspy.InputField(desc="Auth route handler code (login, register, refresh)")
    auth_flows: str = dspy.OutputField(
        desc=(
            "JSON array of {flowName, steps: [{action, component, detail}], "
            "tokenType, sessionStorage, expirationPolicy}"
        )
    )


# =============================================================================
# Modules
# =============================================================================

class FrontendBehavioralAnalysis(dspy.Module):
    """4-step behavioral analysis of frontend screen components."""

    def __init__(self):
        self.identify_screens = dspy.ChainOfThought(IdentifyScreens)
        self.analyze_component = dspy.ChainOfThought(AnalyzeComponent)
        self.trace_user_flows = dspy.ChainOfThought(TraceUserFlows)
        self.verify_claims = dspy.ChainOfThought(VerifyBehavioralClaims)

    def forward(
        self,
        file_list: str,
        routes: str,
        file_contents: dict,
        handler_code: Optional[str] = None,
    ) -> dspy.Prediction:
        results = []
        user_flows = []
        verified_claims = []

        # Step 1: Identify user-facing screens
        try:
            screen_result = self.identify_screens(file_list=file_list, routes=routes)
            screens = json.loads(screen_result.screens)
        except Exception as e:
            return dspy.Prediction(
                specs=json.dumps([]),
                user_flows=json.dumps([]),
                verified_claims=json.dumps([]),
                error=f"Step 1 (IdentifyScreens) failed: {str(e)}",
            )

        # Step 2: Analyze each screen component
        for screen in screens[:15]:  # Cap at 15 screens
            path = screen.get("filePath", "")
            content = file_contents.get(path, "")
            if not content:
                continue
            try:
                comp_result = self.analyze_component(
                    component_path=path,
                    component_code=content[:15000],
                    route=screen.get("inferredRoute", ""),
                )
                elements = json.loads(comp_result.elements)
                results.append({
                    "componentPath": path,
                    "componentName": screen.get("componentName", ""),
                    "pageRoute": screen.get("inferredRoute", ""),
                    "purpose": comp_result.purpose,
                    "userRole": comp_result.user_role,
                    "elements": elements,
                    "stateDescription": comp_result.state_description,
                    "dataFlow": comp_result.data_flow,
                    "userFlows": [],  # populated in step 3
                })
            except Exception:
                results.append({
                    "componentPath": path,
                    "componentName": screen.get("componentName", ""),
                    "pageRoute": screen.get("inferredRoute", ""),
                    "purpose": "Analysis failed",
                    "userRole": "unknown",
                    "elements": [],
                    "stateDescription": "",
                    "dataFlow": "",
                    "userFlows": [],
                })

        # Step 3: Trace user flows across components
        try:
            flow_result = self.trace_user_flows(component_specs=json.dumps(results))
            user_flows = json.loads(flow_result.user_flows)
        except Exception:
            user_flows = []

        # Step 4: Verify claims against handler code (if provided)
        if handler_code:
            try:
                all_claims = []
                for spec in results:
                    for el in spec.get("elements", []):
                        if el.get("targetEndpoint"):
                            all_claims.append({
                                "component": spec["componentPath"],
                                "element": el.get("label", ""),
                                "action": el.get("action", ""),
                                "endpoint": el.get("targetEndpoint", ""),
                            })
                if all_claims:
                    verify_result = self.verify_claims(
                        claims=json.dumps(all_claims[:30]),
                        handler_code=handler_code[:15000],
                    )
                    verified_claims = json.loads(verify_result.verified_claims)
            except Exception:
                verified_claims = []

        return dspy.Prediction(
            specs=json.dumps(results),
            user_flows=json.dumps(user_flows),
            verified_claims=json.dumps(verified_claims),
        )


class BackendBehavioralAnalysis(dspy.Module):
    """3-step behavioral analysis of backend API routes and database operations."""

    def __init__(self):
        self.identify_routes = dspy.ChainOfThought(IdentifyRouteFiles)
        self.analyze_endpoint = dspy.ChainOfThought(AnalyzeEndpoint)
        self.trace_db = dspy.ChainOfThought(TraceDbOperations)

    def forward(
        self,
        file_list: str,
        file_contents: dict,
        framework_hint: str = "",
    ) -> dspy.Prediction:
        all_endpoints = []
        all_db_ops = []

        # Step 1: Identify route files
        try:
            route_result = self.identify_routes(
                file_list=file_list,
                framework_hint=framework_hint,
            )
            route_files = json.loads(route_result.route_files)
        except Exception as e:
            return dspy.Prediction(
                endpoints=json.dumps([]),
                db_operations=json.dumps([]),
                error=f"Step 1 (IdentifyRouteFiles) failed: {str(e)}",
            )

        # Step 2: Analyze each route file
        for rf in route_files[:20]:  # Cap at 20 route files
            path = rf.get("filePath", "")
            content = file_contents.get(path, "")
            if not content:
                continue
            try:
                ep_result = self.analyze_endpoint(
                    file_path=path,
                    file_content=content[:15000],
                    framework=rf.get("framework", framework_hint),
                )
                endpoints = json.loads(ep_result.endpoints)
                for ep in endpoints:
                    ep["sourceFile"] = path
                all_endpoints.extend(endpoints)
            except Exception:
                all_endpoints.append({
                    "sourceFile": path,
                    "error": "Endpoint analysis failed",
                })

        # Step 3: Trace DB operations
        for rf in route_files[:20]:
            path = rf.get("filePath", "")
            content = file_contents.get(path, "")
            if not content:
                continue
            try:
                db_result = self.trace_db(handler_code=content[:15000])
                db_ops = json.loads(db_result.db_operations)
                for op in db_ops:
                    op["sourceFile"] = path
                all_db_ops.extend(db_ops)
            except Exception:
                pass

        return dspy.Prediction(
            endpoints=json.dumps(all_endpoints),
            db_operations=json.dumps(all_db_ops),
        )


class MiddlewareAnalysis(dspy.Module):
    """3-step analysis of middleware, route-middleware mapping, and auth flows."""

    def __init__(self):
        self.find_middleware = dspy.ChainOfThought(FindMiddleware)
        self.map_routes = dspy.ChainOfThought(MapRoutesToMiddleware)
        self.trace_auth = dspy.ChainOfThought(TraceAuthFlows)

    def forward(
        self,
        entry_file_content: str,
        middleware_files: list,
        route_files_summary: str,
        auth_middleware_code: str = "",
        auth_route_code: str = "",
    ) -> dspy.Prediction:
        middleware_list = []
        route_map = []
        auth_flows = []

        # Step 1: Find middleware
        try:
            mw_result = self.find_middleware(
                entry_file_content=entry_file_content[:15000],
                middleware_dir_files=json.dumps(
                    [{
                        "path": mf.get("path", ""),
                        "content": mf.get("content", "")[:15000],
                    } for mf in middleware_files[:10]]
                ),
            )
            middleware_list = json.loads(mw_result.middleware_list)
        except Exception as e:
            return dspy.Prediction(
                middleware=json.dumps([]),
                route_middleware_map=json.dumps([]),
                auth_flows=json.dumps([]),
                error=f"Step 1 (FindMiddleware) failed: {str(e)}",
            )

        # Step 2: Map routes to middleware
        try:
            map_result = self.map_routes(
                middleware_list=json.dumps(middleware_list),
                route_files_summary=route_files_summary[:15000],
            )
            route_map = json.loads(map_result.route_middleware_map)
        except Exception:
            route_map = []

        # Step 3: Trace auth flows (if auth code provided)
        if auth_middleware_code or auth_route_code:
            try:
                auth_result = self.trace_auth(
                    auth_middleware_code=auth_middleware_code[:15000],
                    auth_route_code=auth_route_code[:15000],
                )
                auth_flows = json.loads(auth_result.auth_flows)
            except Exception:
                auth_flows = []

        return dspy.Prediction(
            middleware=json.dumps(middleware_list),
            route_middleware_map=json.dumps(route_map),
            auth_flows=json.dumps(auth_flows),
        )
