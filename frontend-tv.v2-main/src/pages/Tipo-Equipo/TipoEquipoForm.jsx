import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Field, Form, Formik } from "formik";
import { Link } from "react-router-dom";
import * as Yup from "yup";
import Swal from "sweetalert2";

import api from "../../utils/api";
import stylesEquipment from "../Equipment/Equipment.module.css";
import TipoEquipoList from "./TipoEquipoList";

const SchemaTipoEquipos = Yup.object().shape({
    tipoNombre: Yup.string()
        .trim("No debe tener espacios al inicio o al final")
        .required("Campo obligatorio"),
});

export const TipoEquipoManager = ({ tipos, onRefresh, className = "" }) => {
    const [internalTipos, setInternalTipos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const isControlled = Array.isArray(tipos);

    const fetchInternalTipos = useCallback(async () => {
        try {
            setIsLoading(true);
            const { data } = await api.getTipoEquipo();
            setInternalTipos(data || []);
        } catch (error) {
            console.warn("Error getTipoEquipo:", error?.response?.data || error?.message);
            setInternalTipos([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isControlled) {
            fetchInternalTipos();
        }
    }, [isControlled, fetchInternalTipos]);

    const effectiveTipos = useMemo(() => {
        const source = isControlled ? tipos || [] : internalTipos;
        const seen = new Map();

        for (const tipo of source) {
            const key = (tipo?.tipoNombre || "").trim().toLowerCase();
            if (key && !seen.has(key)) {
                seen.set(key, tipo);
            }
        }

        return Array.from(seen.values()).sort((a, b) =>
            (a?.tipoNombre || "").localeCompare(b?.tipoNombre || "", undefined, {
                sensitivity: "base",
            })
        );
    }, [isControlled, tipos, internalTipos]);

    const refreshTipos = useCallback(async () => {
        if (onRefresh) {
            await onRefresh();
        } else {
            await fetchInternalTipos();
        }
    }, [onRefresh, fetchInternalTipos]);

    const containerClassName = `${stylesEquipment.tipo__section} ${className}`.trim();

    return (
        <div className={containerClassName}>
            <hr className={stylesEquipment.section__divider} />

            <Formik
                initialValues={{ tipoNombre: "" }}
                validationSchema={SchemaTipoEquipos}
                onSubmit={async (values, { resetForm, setSubmitting }) => {
                    const normalized = values.tipoNombre.trim().toLowerCase();

                    try {
                        setSubmitting(true);
                        await api.createTipoEquipo({ tipoNombre: normalized });
                        Swal.fire({
                            title: "Tipo de equipo guardado exitosamente",
                            icon: "success",
                            html: `<p><strong>Tipo:</strong> ${normalized}</p>`,
                        });
                        resetForm();
                        await refreshTipos();
                    } catch (error) {
                        Swal.fire({
                            title: "Error",
                            icon: "error",
                            text: `Duplicidad de datos`,
                            footer: `${error.response?.data?.message || "Error desconocido"}`,
                        });
                    } finally {
                        setSubmitting(false);
                    }
                }}
            >
                {({ errors, touched, isSubmitting }) => (
                    <Form className="form__add">
                        <h1 className="form__titulo">Registrar Tipo Equipo</h1>
                        <div className={stylesEquipment.rows__group}>
                            <div className={stylesEquipment.columns__group}>
                                <div className="form__group">
                                    <label htmlFor="tipoNombre" className="form__group-label">
                                        Tipo equipo
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Tipo equipo"
                                            name="tipoNombre"
                                        />
                                    </label>
                                    {errors.tipoNombre && touched.tipoNombre && (
                                        <div className="form__group-error">{errors.tipoNombre}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="button btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Guardando..." : "Enviar"}
                        </button>
                    </Form>
                )}
            </Formik>

            <TipoEquipoList tipos={effectiveTipos} onRefresh={refreshTipos} isLoading={isLoading} />
        </div>
    );
};

const TipoEquipoForm = () => {
    return (
        <div className="outlet-main">
            <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                        <Link to="/list-type-equitment">Listar</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                        Formulario
                    </li>
                </ol>
            </nav>
            <h1>Registro de Tipo Equipo</h1>
            <TipoEquipoManager />
        </div>
    );
};

export default TipoEquipoForm;
